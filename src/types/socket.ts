import type { GameRoom, Player, PowerUpType } from './game';

// ============================================================
// Client -> Server Events
// ============================================================

export interface ClientToServerEvents {
  join_room: (data: { roomCode: string; playerName: string }) => void;
  create_room: (data: { playerName: string }) => void;
  start_game: (data: { roomCode: string }) => void;
  submit_answer: (data: {
    questionId: string;
    answerIndex: number;
    timestamp: number;
  }) => void;
  use_power_up: (data: {
    powerUpType: PowerUpType;
    targetPlayerId?: string;
  }) => void;
  jack_attack_buzz: (data: { answerId: string; timestamp: number }) => void;
  play_again: () => void;
  leave_room: () => void;
}

// ============================================================
// Server -> Client Events
// ============================================================

export interface ServerToClientEvents {
  room_created: (data: { room: ClientGameRoom; player: Player }) => void;
  room_joined: (data: { room: ClientGameRoom; player: Player }) => void;
  player_joined: (data: { player: Player }) => void;
  player_left: (data: { playerId: string; reason?: string }) => void;
  game_starting: (data: { hostScript?: string; audioUrl?: string }) => void;
  question_intro: (data: {
    question: Record<string, unknown>;
    hostScript?: string;
    audioUrl?: string;
  }) => void;
  question_active: (data: {
    question: Record<string, unknown>;
    timeLimit: number;
  }) => void;
  answer_received: (data: { playerId: string }) => void;
  question_reveal: (data: {
    correctAnswer: number;
    playerResults: Record<string, unknown>[];
    hostScript?: string;
    audioUrl?: string;
  }) => void;
  scores_update: (data: {
    scores: { playerId: string; name: string; money: number }[];
    powerUpsGranted?: { playerId: string; powerUp: string }[];
  }) => void;
  round_transition: (data: {
    round: number;
    hostScript?: string;
    audioUrl?: string;
  }) => void;
  jack_attack_start: (data: { theme: string; clue: string }) => void;
  jack_attack_word: (data: {
    wordId: string;
    word: string;
    expiresAt: number;
  }) => void;
  jack_attack_buzz_result: (data: {
    playerId: string;
    wordId: string;
    correct: boolean;
    moneyDelta: number;
  }) => void;
  jack_attack_end: (data: { results: Record<string, unknown> }) => void;
  game_over: (data: {
    finalScores: { playerId: string; name: string; money: number }[];
    hostScript?: string;
    audioUrl?: string;
    gameStats?: Record<string, unknown>;
  }) => void;
  power_up_used: (data: {
    playerId: string;
    powerUpType: PowerUpType;
    effect: string;
  }) => void;
  error: (data: { message: string }) => void;
  host_audio: (data: { audioUrl: string }) => void;
  loading_progress: (data: { completed: number; total: number; message: string }) => void;
}

// ============================================================
// Client-safe room (no secrets)
// ============================================================

export interface ClientGameRoom {
  id: string;
  hostPlayerId: string;
  players: Player[];
  state: string;
  round: number;
  questionIndex: number;
  theme?: string;
  createdAt: number;
  startedAt?: number;
}
