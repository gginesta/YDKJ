// ============================================================
// Game State & Core Types
// ============================================================

export enum GameState {
  LOBBY = 'lobby',
  GAME_STARTING = 'game_starting',
  ROUND_INTRO = 'round_intro',
  QUESTION_INTRO = 'question_intro',
  QUESTION_ACTIVE = 'question_active',
  QUESTION_REVEAL = 'question_reveal',
  SCORES_UPDATE = 'scores_update',
  ROUND_TRANSITION = 'round_transition',
  JACK_ATTACK_INTRO = 'jack_attack_intro',
  JACK_ATTACK_ACTIVE = 'jack_attack_active',
  JACK_ATTACK_RESULTS = 'jack_attack_results',
  GAME_OVER = 'game_over',
  POST_GAME = 'post_game',
}

// ============================================================
// Player
// ============================================================

export interface Player {
  id: string;
  name: string;
  money: number;
  streak: number;
  powerUps: PowerUp[];
  answers: AnswerRecord[];
  connected: boolean;
  joinedAt: number;
}

// ============================================================
// Game Room
// ============================================================

export interface GameRoom {
  id: string;              // 4-letter room code
  hostPlayerId: string;
  players: Player[];
  state: GameState;
  round: number;
  questionIndex: number;
  theme?: string;
  questions: Question[];
  jackAttack: JackAttackRound | null;
  createdAt: number;
  startedAt?: number;
}

// ============================================================
// Question Types
// ============================================================

export type QuestionType =
  | 'multiple_choice'
  | 'dis_or_dat'
  | 'gibberish'
  | 'three_way'
  | 'jack_attack';

export interface BaseQuestion {
  id: string;
  type: QuestionType;
  category: string;
  value: number;
  timeLimit: number;
  hostIntro: string;
  hostCorrect: string;
  hostWrong: string;
  hostTimeout: string;
  easterEgg?: EasterEgg;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple_choice';
  prompt: string;
  choices: string[];
  correctIndex: number;
  wrongAnswerOfTheGame?: number;
}

export interface DisOrDatQuestion extends BaseQuestion {
  type: 'dis_or_dat';
  categoryA: string;
  categoryB: string;
  items: {
    text: string;
    correct: 'A' | 'B';
  }[];
}

export interface GibberishQuestion extends BaseQuestion {
  type: 'gibberish';
  gibberishPhrase: string;
  audioUrl?: string;
  choices: string[];
  correctIndex: number;
  hint?: string;
}

export interface ThreeWayQuestion extends BaseQuestion {
  type: 'three_way';
  prompt: string;
  choices: string[];
  correctIndex: number;
}

export interface JackAttackRound {
  theme: string;
  clue: string;
  pairs: {
    answer: string;
    isCorrect: boolean;
  }[];
  matchValue: number;
  penaltyValue: number;
}

export type Question =
  | MultipleChoiceQuestion
  | DisOrDatQuestion
  | GibberishQuestion
  | ThreeWayQuestion;

// ============================================================
// Power-Ups
// ============================================================

export type PowerUpType =
  | 'time_steal'
  | 'double_down'
  | 'fake_answer'
  | 'point_leech'
  | 'immunity'
  | 'reveal';

export interface PowerUp {
  type: PowerUpType;
  name: string;
  description: string;
  icon: string;
}

// ============================================================
// Answer Records
// ============================================================

export interface AnswerRecord {
  questionId: string;
  questionType: QuestionType;
  answeredAt: number;
  timeToAnswer: number;
  isCorrect: boolean;
  selectedIndex?: number;
  selectedCategory?: 'A' | 'B';
  moneyEarned: number;
  speedBonus: number;
  powerUpUsed?: PowerUpType;
}

export interface DisOrDatAnswer {
  playerId: string;
  itemIndex: number;
  selected: 'A' | 'B';
  timestamp: number;
}

// ============================================================
// Easter Eggs
// ============================================================

export interface EasterEgg {
  type:
    | 'wrong_answer_of_the_game'
    | 'speed_demon'
    | 'category_sweep'
    | 'last_to_first'
    | 'the_contrarian';
  trigger: string;
  reward: number;
  hostReaction: string;
}
