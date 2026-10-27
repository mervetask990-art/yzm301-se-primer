export type LevelId = 'new' | 'mid' | 'senior';
export type RoleId = 'backend' | 'frontend' | 'devops' | 'qa';
export type GoalId = 'interview' | 'work' | 'curious';
export type ChoiceId = 'A' | 'B';

export interface ChoiceData {
  label: string;
  minutes: number;
  what: string;
  why: string;
  research: string[];
}

export interface DecisionData {
  id: string;
  topic: string;
  prompt: string;
  hint: string;
  tutorQuestion: string;
  choices: {
    A: ChoiceData;
    B: ChoiceData;
  };
  combo?: {
    [key: string]: {
      minutes: number;
      what: string;
      why: string;
      research: string[];
    };
  };
}

export interface ScenarioData {
  id: string;
  title: string;
  startClock: string;
  intake: {
    level: Array<{ id: LevelId; label: string; hints: string; timerSeconds: number | null }>;
    role: Array<{ id: RoleId; label: string }>;
    goal: Array<{ id: GoalId; label: string }>;
  };
  intro: {
    text: string;
    roleLine: Record<RoleId, string>;
  };
  decisions: DecisionData[];
  timeout: {
    defaultChoice: ChoiceId;
    what: string;
    why: string;
    research: string[];
  };
  endings: {
    rule: string;
    A: {
      title: string;
      text: string;
    };
    B: {
      title: string;
      text: string;
    };
  };
  clockRule: string;
  clockTable: Record<string, string>;
}

export type GameStep = 'intake' | 'intro' | 'decision' | 'outcome' | 'ending';

export interface GameState {
  step: GameStep;
  currentDecisionIndex: number; // 0, 1, 2
  level: LevelId | null;
  role: RoleId | null;
  goal: GoalId | null;
  choices: Record<string, ChoiceId>; // e.g. { K1: 'A', K2: 'B', K3: 'A' }
  timedOut: Record<string, boolean>; // e.g. { K1: false, K2: true }
  accumulatedMinutes: number;
  revealedHints: Record<string, boolean>; // for mid-level hint toggle
  collectedResearch: string[];
  viewAlternateEnding: boolean; // toggle in ending screen
  tutorMessages: number; // questions the player sent to the tutor this run
}

export type GameAction =
  | { type: 'SET_LEVEL'; level: LevelId }
  | { type: 'SET_ROLE'; role: RoleId }
  | { type: 'SET_GOAL'; goal: GoalId }
  | { type: 'START_INTAKE' }
  | { type: 'START_INTRO' }
  | { type: 'MAKE_CHOICE'; choice: ChoiceId; isTimeout?: boolean }
  | { type: 'TOGGLE_HINT'; decisionId: string }
  | { type: 'NEXT_STEP' }
  | { type: 'TOGGLE_ALTERNATE_ENDING' }
  | { type: 'TUTOR_MESSAGE' }
  | { type: 'RESTART' };
