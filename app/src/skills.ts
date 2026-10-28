// Skill map: one mastery score (0-100) per topic. Everything adaptive in the app reads from here,
// and everything the player does (decisions, predictions, explanations, reviews) writes to it.
import { LevelId } from './types';

export type TopicId = 'deploy' | 'test' | 'security' | 'observability' | 'performance' | 'team';

export const TOPICS: { id: TopicId; label: string; short: string }[] = [
  { id: 'deploy', label: 'Mimari ve deploy', short: 'Deploy' },
  { id: 'test', label: 'Test', short: 'Test' },
  { id: 'security', label: 'Güvenlik ve KVKK', short: 'Güvenlik' },
  { id: 'observability', label: 'Gözlemlenebilirlik', short: 'Gözlem' },
  { id: 'performance', label: 'Performans', short: 'Performans' },
  { id: 'team', label: 'Ekip ve iletişim', short: 'Ekip' },
];

export const TOPIC_IDS = TOPICS.map((t) => t.id);

export const isTopic = (v: unknown): v is TopicId => TOPIC_IDS.includes(v as TopicId);

export const topicLabel = (id: TopicId) => TOPICS.find((t) => t.id === id)?.label ?? id;

export interface SkillEvent {
  date: string; // ISO
  topic: TopicId;
  delta: number;
  reason: string;
}

// Self-declared level only seeds topics the player has no evidence for yet
const SEED: Record<LevelId, number> = { new: 15, mid: 45, senior: 70 };

export function skillScore(
  skills: Partial<Record<TopicId, number>>,
  topic: TopicId,
  fallbackLevel: LevelId | null,
): number {
  return skills[topic] ?? SEED[fallbackLevel ?? 'mid'];
}

// Tier decides how much support a topic gets: new = full support, senior = least
export function tierFor(score: number): LevelId {
  if (score < 35) return 'new';
  if (score < 70) return 'mid';
  return 'senior';
}

export const tierLabel: Record<LevelId, string> = {
  new: 'başlangıç',
  mid: 'gelişen',
  senior: 'güçlü',
};

// Very strong topics get less time: support keeps fading as the player grows
export function timerSecondsFor(tier: LevelId, score: number): number | null {
  if (tier !== 'senior') return null;
  return score >= 85 ? 45 : 60;
}

export function applySkillEvents(
  skills: Partial<Record<TopicId, number>>,
  events: SkillEvent[],
  fallbackLevel: LevelId | null,
): Partial<Record<TopicId, number>> {
  const next = { ...skills };
  for (const e of events) {
    const base = skillScore(next, e.topic, fallbackLevel);
    next[e.topic] = Math.max(0, Math.min(100, Math.round(base + e.delta)));
  }
  return next;
}

export const event = (topic: TopicId, delta: number, reason: string): SkillEvent => ({
  date: new Date().toISOString(),
  topic,
  delta,
  reason,
});

// ---------- Spaced repetition ----------

export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14];

export type ReviewResult = 'solid' | 'partial' | 'gap';

export interface NotebookEntry {
  concept: string;
  topic: TopicId;
  explanation: string; // the player's own words (latest)
  createdAt: string;
  stage: number; // index into REVIEW_INTERVAL_DAYS; beyond the end = mastered
  nextReview: string; // ISO
  reviews: { date: string; result: ReviewResult }[];
}

const addDays = (from: number, days: number) => new Date(from + days * 86_400_000).toISOString();

export function newEntry(concept: string, topic: TopicId, explanation: string, now = Date.now()): NotebookEntry {
  return {
    concept,
    topic,
    explanation: explanation.trim(),
    createdAt: new Date(now).toISOString(),
    stage: 0,
    nextReview: addDays(now, REVIEW_INTERVAL_DAYS[0]),
    reviews: [],
  };
}

export function scheduleAfterReview(
  entry: NotebookEntry,
  result: ReviewResult,
  explanation: string,
  now = Date.now(),
): NotebookEntry {
  const stage = result === 'solid' ? entry.stage + 1 : result === 'partial' ? entry.stage : 0;
  // Past the last interval the concept counts as mastered and comes back once a month
  const days = stage < REVIEW_INTERVAL_DAYS.length ? REVIEW_INTERVAL_DAYS[stage] : 30;
  return {
    ...entry,
    explanation: explanation.trim() || entry.explanation,
    stage,
    nextReview: addDays(now, days),
    reviews: [...entry.reviews, { date: new Date(now).toISOString(), result }],
  };
}

export const isDue = (entry: NotebookEntry, now = Date.now()) => new Date(entry.nextReview).getTime() <= now;

export const REVIEW_DELTA: Record<ReviewResult, number> = { solid: 6, partial: 2, gap: -2 };

// ---------- Prediction alignment ----------

export type Alignment = 'close' | 'partial' | 'missed';

export const PREDICTION_DELTA: Record<Alignment, number> = { close: 5, partial: 2, missed: 0 };

// Word-stem overlap used only when no model is available (offline)
export function overlapScore(a: string, b: string): number {
  const stems = (s: string) =>
    new Set(
      s
        .toLocaleLowerCase('tr-TR')
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length > 3)
        .map((w) => w.slice(0, 5)),
    );
  const sa = stems(a);
  const sb = stems(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let hit = 0;
  sa.forEach((w) => sb.has(w) && hit++);
  return hit / sa.size;
}
