/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useReducer, useRef, useState } from 'react';
import scenarioData from './scenario.json';
import { GameState, GameAction, ScenarioData, ChoiceId } from './types';
import {
  Journal,
  RunRecord,
  clearJournal,
  emptyJournal,
  getInsights,
  learnerContext,
  loadJournal,
  saveJournal,
} from './journal';
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
  const savedRunIdRef = useRef<string | null>(null);

  const currentClock = calculateCurrentClock(state);
  const currentDecision = scenario.decisions[state.currentDecisionIndex];
  const insights = getInsights(journal, scenario);

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
      hintsUsed:
        state.level === 'new'
          ? scenario.decisions.length
          : Object.values(state.revealedHints).filter(Boolean).length,
      tutorMessages: state.tutorMessages,
      research: state.collectedResearch,
    };
    savedRunIdRef.current = run.id;
    updateJournal((j) => ({ ...j, runs: [...j.runs, run].slice(-30) }));
  }, [state.step]);

  const restart = () => {
    savedRunIdRef.current = null;
    setSeniorTimeLeft(null);
    dispatch({ type: 'RESTART' });
  };

  const toggleResearched = (item: string) =>
    updateJournal((j) => ({
      ...j,
      researched: j.researched.includes(item)
        ? j.researched.filter((r) => r !== item)
        : [...j.researched, item],
    }));

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
        {/* Step 1: Intake */}
        {state.step === 'intake' && (
          <IntakeScreen
            scenario={scenario}
            level={state.level}
            role={state.role}
            goal={state.goal}
            onSelectLevel={(lvl) => dispatch({ type: 'SET_LEVEL', level: lvl })}
            onSelectRole={(r) => dispatch({ type: 'SET_ROLE', role: r })}
            onSelectGoal={(g) => dispatch({ type: 'SET_GOAL', goal: g })}
            onStart={() => dispatch({ type: 'START_INTAKE' })}
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
              isSenior={state.level === 'senior'}
              timeLeftSeconds={seniorTimeLeft}
            />
            <DecisionScreen
              decision={currentDecision}
              decisionNumber={state.currentDecisionIndex + 1}
              level={state.level}
              revealedHint={Boolean(state.revealedHints[currentDecision.id])}
              onToggleHint={() =>
                dispatch({ type: 'TOGGLE_HINT', decisionId: currentDecision.id })
              }
              onMakeChoice={(choice: ChoiceId, isTimeout?: boolean) => {
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
