import { ChoiceId, GoalId, LevelId, RoleId, ScenarioData } from './types';

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

export interface Journal {
  name: string;
  runs: RunRecord[];
  researched: string[]; // concepts the player marked as researched
}

export const emptyJournal: Journal = { name: '', runs: [], researched: [] };

export function loadJournal(): Journal {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyJournal;
    const parsed = JSON.parse(raw) as Partial<Journal>;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      researched: Array.isArray(parsed.researched) ? parsed.researched : [],
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
  lastRun?: RunRecord;
  weakTopic?: string; // decision topic where the player most often took the risky path
  nextResearch?: string; // first concept from the last run that is not researched yet
  suggestedLevel?: LevelId;
  suggestionReason?: string;
}

const LEVEL_ORDER: LevelId[] = ['new', 'mid', 'senior'];

export function getInsights(journal: Journal, scenario: ScenarioData): Insights {
  const runs = journal.runs;
  const lastRun = runs[runs.length - 1];
  const insights: Insights = {
    runCount: runs.length,
    goodEndings: runs.filter((r) => r.ending === 'A').length,
    researchedCount: journal.researched.length,
    lastRun,
  };
  if (!lastRun) return insights;

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
    lastReflection: insights.lastRun?.reflection,
  };
}

export const levelLabel = (scenario: ScenarioData, id: LevelId) =>
  scenario.intake.level.find((l) => l.id === id)?.label ?? id;
