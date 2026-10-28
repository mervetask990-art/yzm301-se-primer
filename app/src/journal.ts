import { ChoiceId, GoalId, LevelId, RoleId, ScenarioData } from './types';
import {
  Alignment,
  NotebookEntry,
  SkillEvent,
  TOPICS,
  TopicId,
  applySkillEvents,
  isDue,
  skillScore,
  tierFor,
} from './skills';

// Personal learning journal: lives only in this browser (no account, no server).
const STORAGE_KEY = 'se-primer-journal-v1';

export interface RunRecord {
  id: string;
  date: string; // ISO
  level: LevelId;
  role: RoleId;
  goal: GoalId;
  choices: Record<string, ChoiceId>;
  timedOut: Record<string, boolean>;
  ending: 'A' | 'B';
  clock: string;
  hintsUsed: number;
  tutorMessages: number;
  research: string[];
  reflection?: string;
}

// One Pusula session: the player's own question and the paths they walked through
export interface PusulaRecord {
  id: string;
  date: string; // ISO
  question: string;
  trail: string[]; // titles of chosen paths, in order
  research: string[];
  reflection?: string;
}

export interface PredictionRecord {
  date: string;
  topic: TopicId;
  alignment: Alignment;
}

export interface Journal {
  name: string;
  runs: RunRecord[];
  researched: string[]; // concepts the player marked as researched
  pusula: PusulaRecord[];
  skills: Partial<Record<TopicId, number>>; // mastery 0-100; missing = not yet measured
  skillEvents: SkillEvent[]; // growth timeline (latest last)
  conceptTopics: Record<string, TopicId>; // which topic a researched concept belongs to
  notebook: NotebookEntry[]; // concepts explained in the player's own words
  predictions: PredictionRecord[];
}

export const emptyJournal: Journal = {
  name: '',
  runs: [],
  researched: [],
  pusula: [],
  skills: {},
  skillEvents: [],
  conceptTopics: {},
  notebook: [],
  predictions: [],
};

const obj = <T,>(v: unknown, fallback: T): T => (v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : fallback);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function loadJournal(): Journal {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyJournal;
    const parsed = JSON.parse(raw) as Partial<Journal>;
    // Older journals lack the skill fields; fill them so existing players keep their history
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      runs: arr(parsed.runs),
      researched: arr(parsed.researched),
      pusula: arr(parsed.pusula),
      skills: obj(parsed.skills, {}),
      skillEvents: arr(parsed.skillEvents),
      conceptTopics: obj(parsed.conceptTopics, {}),
      notebook: arr(parsed.notebook),
      predictions: arr(parsed.predictions),
    };
  } catch {
    return emptyJournal;
  }
}

export function saveJournal(journal: Journal): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(journal));
  } catch {
    // Private mode or blocked storage: the game still works, it just forgets.
  }
}

export function clearJournal(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export interface Insights {
  runCount: number;
  goodEndings: number;
  researchedCount: number;
  pusulaCount: number;
  lastPusula?: PusulaRecord;
  lastRun?: RunRecord;
  weakTopic?: string; // decision topic where the player most often took the risky path
  nextResearch?: string; // first concept from the last run that is not researched yet
  suggestedLevel?: LevelId;
  suggestionReason?: string;
  dueReviews: number; // notebook concepts whose review date has come
  pendingExplanations: string[]; // researched concepts not yet explained in own words
  predictionAccuracy?: { recent: number; earlier?: number; count: number }; // 0..1
}

const LEVEL_ORDER: LevelId[] = ['new', 'mid', 'senior'];

export function getInsights(journal: Journal, scenario: ScenarioData): Insights {
  const runs = journal.runs;
  const lastRun = runs[runs.length - 1];
  const insights: Insights = {
    runCount: runs.length,
    goodEndings: runs.filter((r) => r.ending === 'A').length,
    researchedCount: journal.researched.length,
    pusulaCount: journal.pusula.length,
    lastPusula: journal.pusula[journal.pusula.length - 1],
    lastRun,
    dueReviews: journal.notebook.filter((e) => isDue(e)).length,
    pendingExplanations: journal.researched.filter(
      (c) => !journal.notebook.some((e) => e.concept === c),
    ),
  };

  // Prediction accuracy: last 5 vs the 5 before, so growth is visible
  const score = (list: PredictionRecord[]) =>
    list.reduce((s, p) => s + (p.alignment === 'close' ? 1 : p.alignment === 'partial' ? 0.5 : 0), 0) / list.length;
  const preds = journal.predictions;
  if (preds.length > 0) {
    const recent = preds.slice(-5);
    const earlier = preds.slice(-10, -5);
    insights.predictionAccuracy = {
      recent: score(recent),
      earlier: earlier.length ? score(earlier) : undefined,
      count: preds.length,
    };
  }

  if (!lastRun) {
    // Pusula-only players still get a "next research" suggestion
    insights.nextResearch = insights.lastPusula?.research.find((item) => !journal.researched.includes(item));
    return insights;
  }

  // Weak topic: count risky (B) or timed-out decisions over the last 5 runs
  const recent = runs.slice(-5);
  let worst = { topic: '', count: 0 };
  for (const decision of scenario.decisions) {
    const count = recent.filter(
      (r) => r.choices[decision.id] === 'B' || r.timedOut[decision.id],
    ).length;
    if (count > worst.count) worst = { topic: decision.topic, count };
  }
  if (worst.count > 0) insights.weakTopic = worst.topic;

  insights.nextResearch = lastRun.research.find((item) => !journal.researched.includes(item));

  // Level suggestion: two clean good endings in a row → step up; timeouts → step down
  const levelIndex = LEVEL_ORDER.indexOf(lastRun.level);
  const lastTwo = runs.slice(-2);
  const timeouts = Object.values(lastRun.timedOut).filter(Boolean).length;
  if (
    lastTwo.length === 2 &&
    lastTwo.every((r) => r.ending === 'A' && r.level === lastRun.level) &&
    timeouts === 0 &&
    levelIndex < LEVEL_ORDER.length - 1
  ) {
    insights.suggestedLevel = LEVEL_ORDER[levelIndex + 1];
    insights.suggestionReason = 'Son iki nöbeti iyi sonla bitirdin, bir üst seviyeyi dene.';
  } else if (lastRun.level === 'senior' && timeouts >= 2) {
    insights.suggestedLevel = 'mid';
    insights.suggestionReason = 'Süre baskısı ağır geldi; önce ipuçlarıyla pekiştir.';
  }

  return insights;
}

// Short summary sent to the tutor so it can build on what the player already explored
export function learnerContext(journal: Journal, insights: Insights) {
  return {
    name: journal.name || undefined,
    runCount: insights.runCount,
    researched: journal.researched.slice(-8),
    weakTopic: insights.weakTopic,
    lastReflection: insights.lastRun?.reflection ?? insights.lastPusula?.reflection,
    recentQuestions: journal.pusula.slice(-3).map((p) => p.question),
    // Only measured topics: lets the model speak more technically where the player is strong
    skills: Object.fromEntries(
      TOPICS.filter((t) => journal.skills[t.id] !== undefined).map((t) => [
        t.id,
        tierFor(journal.skills[t.id]!),
      ]),
    ),
  };
}

export function recordSkillEvents(journal: Journal, events: SkillEvent[], fallbackLevel: LevelId | null): Journal {
  if (events.length === 0) return journal;
  return {
    ...journal,
    skills: applySkillEvents(journal.skills, events, fallbackLevel),
    skillEvents: [...journal.skillEvents, ...events].slice(-150),
  };
}

export const topicScore = (journal: Journal, topic: TopicId, fallbackLevel: LevelId | null) =>
  skillScore(journal.skills, topic, fallbackLevel);

export function upsertPusula(journal: Journal, record: PusulaRecord): Journal {
  const existing = journal.pusula.find((p) => p.id === record.id);
  const merged = existing ? { ...record, reflection: existing.reflection } : record;
  const others = journal.pusula.filter((p) => p.id !== record.id);
  return { ...journal, pusula: [...others, merged].slice(-20) };
}

export const levelLabel = (scenario: ScenarioData, id: LevelId) =>
  scenario.intake.level.find((l) => l.id === id)?.label ?? id;
