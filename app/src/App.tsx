/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useReducer, useRef, useState } from 'react';
import scenarioData from './scenario.json';
import { GameState, GameAction, ScenarioData, ChoiceId, DecisionData, LevelId } from './types';
import {
  SkillEvent,
  TopicId,
  event as skillEvent,
  newEntry,
  scheduleAfterReview,
  REVIEW_DELTA,
  PREDICTION_DELTA,
  tierFor,
  timerSecondsFor,
  topicLabel,
} from './skills';
import {
  Journal,
  RunRecord,
  clearJournal,
  emptyJournal,
  getInsights,
  learnerContext,
  loadJournal,
  saveJournal,
  upsertPusula,
  recordSkillEvents,
  topicScore,
} from './journal';
import { PusulaFlow } from './components/PusulaFlow';
import { NotebookScreen } from './components/NotebookScreen';
import { IntakeScreen } from './components/IntakeScreen';
import { IntroScreen } from './components/IntroScreen';
import { DecisionScreen } from './components/DecisionScreen';
import { OutcomeScreen } from './components/OutcomeScreen';
import { EndingScreen } from './components/EndingScreen';
import { TopBar } from './components/TopBar';
import { TutorSheet } from './components/TutorSheet';

const scenario = scenarioData as unknown as ScenarioData;

const initialState: GameState = {
  step: 'intake',
  currentDecisionIndex: 0,
  level: null,
  role: null,
  goal: null,
  choices: {},
  timedOut: {},
  accumulatedMinutes: 0,
  revealedHints: {},
  collectedResearch: [],
  viewAlternateEnding: false,
  tutorMessages: 0,
};

// Returning players start with their last profile preselected
function initFromJournal(journal: Journal): GameState {
  const last = journal.runs[journal.runs.length - 1];
  if (!last) return initialState;
  return { ...initialState, level: last.level, role: last.role, goal: last.goal };
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_LEVEL':
      return { ...state, level: action.level };
    case 'SET_ROLE':
      return { ...state, role: action.role };
    case 'SET_GOAL':
      return { ...state, goal: action.goal };
    case 'START_INTAKE':
      return { ...state, step: 'intro' };
    case 'START_INTRO':
      return { ...state, step: 'decision', currentDecisionIndex: 0 };
    case 'TOGGLE_HINT':
      return {
        ...state,
        revealedHints: {
          ...state.revealedHints,
          [action.decisionId]: true,
        },
      };
    case 'MAKE_CHOICE': {
      const decisionIndex = state.currentDecisionIndex;
      const decision = scenario.decisions[decisionIndex];
      const choice = action.choice;
      const isTimeout = Boolean(action.isTimeout);

      // Check combo B+B on K2
      const isK2 = decisionIndex === 1;
      const isComboBB = isK2 && state.choices['K1'] === 'B' && choice === 'B';

      // Gather research points
      let newResearch: string[] = [];
      if (isComboBB && decision.combo?.['B+B']) {
        newResearch = decision.combo['B+B'].research;
      } else {
        newResearch = decision.choices[choice].research;
      }

      if (isTimeout && scenario.timeout.research) {
        newResearch = [...newResearch, ...scenario.timeout.research];
      }

      // Merge unique research
      const mergedResearch = Array.from(
        new Set([...state.collectedResearch, ...newResearch])
      );

      return {
        ...state,
        choices: {
          ...state.choices,
          [decision.id]: choice,
        },
        timedOut: {
          ...state.timedOut,
          [decision.id]: isTimeout,
        },
        collectedResearch: mergedResearch,
        step: 'outcome',
      };
    }
    case 'NEXT_STEP': {
      if (state.currentDecisionIndex < scenario.decisions.length - 1) {
        return {
          ...state,
          step: 'decision',
          currentDecisionIndex: state.currentDecisionIndex + 1,
        };
      }
      return {
        ...state,
        step: 'ending',
      };
    }
    case 'TOGGLE_ALTERNATE_ENDING':
      return {
        ...state,
        viewAlternateEnding: !state.viewAlternateEnding,
      };
    case 'TUTOR_MESSAGE':
      return { ...state, tutorMessages: state.tutorMessages + 1 };
    case 'RESTART':
      return {
        ...initialState,
        level: state.level,
        role: state.role,
        goal: state.goal,
      };
    default:
      return state;
  }
}

// Research concepts of the crisis belong to the topic of the decision that produced them
const CRISIS_CONCEPT_TOPICS: Record<string, TopicId> = (() => {
  const map: Record<string, TopicId> = {};
  for (const d of scenario.decisions) {
    for (const c of Object.values(d.choices)) c.research.forEach((r) => (map[r] = d.skillTopic));
    Object.values(d.combo ?? {}).forEach((c) => c.research.forEach((r) => (map[r] = d.skillTopic)));
  }
  scenario.timeout.research.forEach((r) => (map[r] = scenario.timeout.skillTopic));
  return map;
})();

const LEVEL_RANK: Record<LevelId, number> = { new: 0, mid: 1, senior: 2 };

function decisionSupport(journal: Journal, decision: DecisionData, chosenLevel: LevelId | null) {
  const score = topicScore(journal, decision.skillTopic, chosenLevel);
  const tier = tierFor(score);
  const timerSeconds = timerSecondsFor(tier, score);
  const label = topicLabel(decision.skillTopic);
  let note: string | undefined;
  if (chosenLevel && LEVEL_RANK[tier] > LEVEL_RANK[chosenLevel]) {
    note = `${label} konusunda güçlendin (${score}/100): ${
      tier === 'senior' ? `ipuçları kapandı, ${timerSeconds} saniyen var.` : 'ipucu artık isteğe bağlı.'
    }`;
  } else if (chosenLevel && LEVEL_RANK[tier] < LEVEL_RANK[chosenLevel]) {
    note = `${label} konusunda zorlanıyorsun (${score}/100): ${
      tier === 'new' ? 'ipucu açık, süre baskısı yok.' : 'süre baskısı kalktı, ipucu isteğe bağlı.'
    }`;
  } else if (timerSeconds !== null && timerSeconds < 60) {
    note = `${label} konusunda çok güçlüsün (${score}/100): süre ${timerSeconds} saniyeye indi.`;
  }
  return { tier, timerSeconds, note };
}

// Evidence from one crisis run: careful choices raise the topic, risky ones and timeouts lower it
function runEvents(state: GameState): SkillEvent[] {
  const events: SkillEvent[] = [];
  for (const d of scenario.decisions) {
    const choice = state.choices[d.id];
    if (!choice) continue;
    if (state.timedOut[d.id]) {
      events.push(skillEvent(d.skillTopic, -5, `${d.topic}: süre doldu`));
      events.push(skillEvent(scenario.timeout.skillTopic, -2, 'Kriz anında kararsızlık'));
    } else if (choice === 'A') {
      const hinted = Boolean(state.revealedHints[d.id]);
      events.push(skillEvent(d.skillTopic, hinted ? 5 : 8, `${d.topic}: ${d.choices.A.label}${hinted ? ' (ipucuyla)' : ''}`));
    } else {
      events.push(skillEvent(d.skillTopic, -3, `${d.topic}: ${d.choices.B.label}`));
    }
  }
  if (state.choices['K1'] === 'B' && state.choices['K2'] === 'B') {
    events.push(skillEvent('test', -2, 'Denenmemiş yama testsiz yayında'));
  }
  return events;
}

// Clock follows scenario.clockRule: startClock + minutes of decided choices (+ B+B combo)
function calculateCurrentClock(state: GameState): string {
  const decidedCount =
    state.step === 'ending'
      ? scenario.decisions.length
      : state.step === 'outcome'
      ? state.currentDecisionIndex + 1
      : state.step === 'decision'
      ? state.currentDecisionIndex
      : 0;

  let minutes = 0;
  scenario.decisions.slice(0, decidedCount).forEach((decision) => {
    const choice = state.choices[decision.id];
    if (!choice) return;
    minutes += decision.choices[choice].minutes;
    if (decision.id === 'K2' && state.choices['K1'] === 'B' && choice === 'B') {
      minutes += decision.combo?.['B+B']?.minutes ?? 0;
    }
  });

  const [h, m] = scenario.startClock.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export default function App() {
  const [journal, setJournal] = useState<Journal>(loadJournal);
  const [state, dispatch] = useReducer(gameReducer, journal, initFromJournal);
  const [isTutorOpen, setIsTutorOpen] = useState(false);
  const [seniorTimeLeft, setSeniorTimeLeft] = useState<number | null>(null);
  const [pusulaOpen, setPusulaOpen] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [runSkillEvents, setRunSkillEvents] = useState<SkillEvent[]>([]);
  const savedRunIdRef = useRef<string | null>(null);

  const currentClock = calculateCurrentClock(state);
  const currentDecision = scenario.decisions[state.currentDecisionIndex];
  const insights = getInsights(journal, scenario);

  // Fading support: each decision gets the support its topic's mastery calls for,
  // not the single level the player picked at the start
  const support = currentDecision ? decisionSupport(journal, currentDecision, state.level) : null;

  const updateJournal = (update: (j: Journal) => Journal) => {
    setJournal((prev) => {
      const next = update(prev);
      saveJournal(next);
      return next;
    });
  };

  // Record the finished run in the journal exactly once per playthrough
  useEffect(() => {
    if (state.step !== 'ending' || savedRunIdRef.current) return;
    if (!state.level || !state.role || !state.goal) return;
    const run: RunRecord = {
      id: `run-${Date.now()}`,
      date: new Date().toISOString(),
      level: state.level,
      role: state.role,
      goal: state.goal,
      choices: state.choices,
      timedOut: state.timedOut,
      ending: state.choices['K3'] === 'A' ? 'A' : 'B',
      clock: currentClock,
      hintsUsed: Object.values(state.revealedHints).filter(Boolean).length,
      tutorMessages: state.tutorMessages,
      research: state.collectedResearch,
    };
    savedRunIdRef.current = run.id;
    const events = runEvents(state);
    setRunSkillEvents(events);
    updateJournal((j) =>
      recordSkillEvents({ ...j, runs: [...j.runs, run].slice(-30) }, events, state.level),
    );
  }, [state.step]);

  const restart = () => {
    savedRunIdRef.current = null;
    setSeniorTimeLeft(null);
    setRunSkillEvents([]);
    dispatch({ type: 'RESTART' });
  };

  // Marking a concept researched files it under a topic and nudges that topic's mastery
  const toggleResearched = (item: string, topic?: TopicId) =>
    updateJournal((j) => {
      if (j.researched.includes(item)) {
        return { ...j, researched: j.researched.filter((r) => r !== item) };
      }
      const t = topic ?? j.conceptTopics[item] ?? CRISIS_CONCEPT_TOPICS[item] ?? 'team';
      return recordSkillEvents(
        {
          ...j,
          researched: [...j.researched, item],
          conceptTopics: { ...j.conceptTopics, [item]: t },
        },
        [skillEvent(t, 3, `Araştırdı: ${item}`)],
        state.level,
      );
    });

  const saveReflection = (text: string) => {
    const runId = savedRunIdRef.current;
    updateJournal((j) => ({
      ...j,
      runs: j.runs.map((r) => (r.id === runId ? { ...r, reflection: text.trim() } : r)),
    }));
  };

  return (
    <div className="min-h-screen bg-[#0F1B2D] text-[#E8EEF5] flex flex-col items-center">
      <div className="w-full max-w-[430px] flex flex-col flex-1 relative bg-[#0F1B2D]">
        {/* Notebook: own-words explanations and spaced review */}
        {notebookOpen && (
          <NotebookScreen
            entries={journal.notebook}
            pending={insights.pendingExplanations.map((concept) => ({
              concept,
              topic: journal.conceptTopics[concept] ?? CRISIS_CONCEPT_TOPICS[concept] ?? 'team',
            }))}
            profile={{ level: state.level ?? 'mid', role: state.role ?? 'backend', goal: state.goal ?? 'work', name: journal.name }}
            onAddEntry={(concept, topic, explanation) =>
              updateJournal((j) =>
                recordSkillEvents(
                  { ...j, notebook: [...j.notebook.filter((e) => e.concept !== concept), newEntry(concept, topic, explanation)] },
                  [skillEvent(topic, 4, `Kendi kelimeleriyle açıkladı: ${concept}`)],
                  state.level,
                ),
              )
            }
            onReviewed={(concept, result, explanation) =>
              updateJournal((j) => {
                const entry = j.notebook.find((e) => e.concept === concept);
                if (!entry) return j;
                return recordSkillEvents(
                  {
                    ...j,
                    notebook: j.notebook.map((e) => (e.concept === concept ? scheduleAfterReview(e, result, explanation) : e)),
                  },
                  [skillEvent(entry.topic, REVIEW_DELTA[result], `Tekrar (${result}): ${concept}`)],
                  state.level,
                );
              })
            }
            onExit={() => setNotebookOpen(false)}
          />
        )}

        {/* Pusula: the player's own question, mapped into paths */}
        {pusulaOpen && state.level && state.role && state.goal && (
          <PusulaFlow
            profile={{ level: state.level, role: state.role, goal: state.goal, name: journal.name }}
            learner={learnerContext(journal, insights)}
            researched={journal.researched}
            skills={journal.skills}
            onToggleResearched={toggleResearched}
            onSkillEvents={(events) => updateJournal((j) => recordSkillEvents(j, events, state.level))}
            onPrediction={(topic, alignment) =>
              updateJournal((j) =>
                recordSkillEvents(
                  {
                    ...j,
                    predictions: [...j.predictions, { date: new Date().toISOString(), topic, alignment }].slice(-50),
                  },
                  PREDICTION_DELTA[alignment] > 0
                    ? [skillEvent(topic, PREDICTION_DELTA[alignment], `Tahmin: ${alignment === 'close' ? 'yakın' : 'kısmen'}`)]
                    : [],
                  state.level,
                ),
              )
            }
            onSaveRecord={(record) => updateJournal((j) => upsertPusula(j, record))}
            onUpdateReflection={(id, text) =>
              updateJournal((j) => ({
                ...j,
                pusula: j.pusula.map((p) => (p.id === id ? { ...p, reflection: text.trim() } : p)),
              }))
            }
            onExit={() => setPusulaOpen(false)}
          />
        )}

        {/* Step 1: Intake */}
        {!pusulaOpen && !notebookOpen && state.step === 'intake' && (
          <IntakeScreen
            scenario={scenario}
            level={state.level}
            role={state.role}
            goal={state.goal}
            onSelectLevel={(lvl) => dispatch({ type: 'SET_LEVEL', level: lvl })}
            onSelectRole={(r) => dispatch({ type: 'SET_ROLE', role: r })}
            onSelectGoal={(g) => dispatch({ type: 'SET_GOAL', goal: g })}
            onStart={() => dispatch({ type: 'START_INTAKE' })}
            onStartPusula={() => setPusulaOpen(true)}
            onOpenNotebook={() => setNotebookOpen(true)}
            skills={journal.skills}
            skillEvents={journal.skillEvents}
            name={journal.name}
            onNameChange={(name) => updateJournal((j) => ({ ...j, name }))}
            insights={insights}
            onResetJournal={() => {
              clearJournal();
              setJournal(emptyJournal);
            }}
          />
        )}

        {/* Step 2: Intro */}
        {state.step === 'intro' && state.role && (
          <IntroScreen
            scenario={scenario}
            role={state.role}
            name={journal.name}
            insights={insights}
            onStart={() => dispatch({ type: 'START_INTRO' })}
          />
        )}

        {/* Step 3: Decision */}
        {state.step === 'decision' && state.level && currentDecision && (
          <>
            <TopBar
              clock={currentClock}
              currentDecisionIndex={state.currentDecisionIndex}
              isSenior={support?.timerSeconds != null}
              timeLeftSeconds={seniorTimeLeft}
              totalTimeSeconds={support?.timerSeconds ?? 60}
            />
            <DecisionScreen
              decision={currentDecision}
              decisionNumber={state.currentDecisionIndex + 1}
              level={support?.tier ?? state.level}
              timerSeconds={support?.timerSeconds ?? null}
              supportNote={support?.note}
              revealedHint={Boolean(state.revealedHints[currentDecision.id])}
              onToggleHint={() =>
                dispatch({ type: 'TOGGLE_HINT', decisionId: currentDecision.id })
              }
              onMakeChoice={(choice: ChoiceId, isTimeout?: boolean) => {
                // An always-open hint counts as used support for this decision
                if (support?.tier === 'new') {
                  dispatch({ type: 'TOGGLE_HINT', decisionId: currentDecision.id });
                }
                dispatch({ type: 'MAKE_CHOICE', choice, isTimeout });
              }}
              onOpenTutor={() => setIsTutorOpen(true)}
              onTimeUpdate={(sec) => setSeniorTimeLeft(sec)}
            />
          </>
        )}

        {/* Step 4: Outcome */}
        {state.step === 'outcome' && currentDecision && (
          <>
            <TopBar
              clock={currentClock}
              currentDecisionIndex={state.currentDecisionIndex}
              isSenior={false}
            />
            <OutcomeScreen
              decision={currentDecision}
              choice={state.choices[currentDecision.id] || 'A'}
              decisionNumber={state.currentDecisionIndex + 1}
              isComboBB={
                state.currentDecisionIndex === 1 &&
                state.choices['K1'] === 'B' &&
                state.choices['K2'] === 'B'
              }
              isTimeout={Boolean(state.timedOut[currentDecision.id])}
              scenario={scenario}
              onNext={() => dispatch({ type: 'NEXT_STEP' })}
            />
          </>
        )}

        {/* Step 5: Ending */}
        {state.step === 'ending' && (
          <EndingScreen
            scenario={scenario}
            choices={state.choices}
            finalClock={currentClock}
            collectedResearch={state.collectedResearch}
            viewAlternate={state.viewAlternateEnding}
            onToggleAlternate={() => dispatch({ type: 'TOGGLE_ALTERNATE_ENDING' })}
            onRestart={restart}
            skillEvents={runSkillEvents}
            skills={journal.skills}
            name={journal.name}
            runNumber={insights.runCount}
            researched={journal.researched}
            onToggleResearched={toggleResearched}
            onSaveReflection={saveReflection}
          />
        )}

        {/* AI Tutor Bottom Sheet Modal */}
        {state.step === 'decision' && currentDecision && state.level && state.role && state.goal && (
          <TutorSheet
            isOpen={isTutorOpen}
            onClose={() => setIsTutorOpen(false)}
            decision={currentDecision}
            level={state.level}
            role={state.role}
            goal={state.goal}
            learner={learnerContext(journal, insights)}
            onUserMessage={() => dispatch({ type: 'TUTOR_MESSAGE' })}
          />
        )}
      </div>
    </div>
  );
}
