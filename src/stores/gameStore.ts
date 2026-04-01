import { create } from 'zustand';
import type { Player } from '@/types/game';
import type { ClientGameRoom } from '@/types/socket';

// ============================================================
// Question & Score types for UI state
// ============================================================

export interface UIQuestion {
  id: string;
  type: string;
  category: string;
  value: number;
  timeLimit: number;
  // Multiple choice / Gibberish / ThreeWay
  prompt?: string;
  choices?: string[];
  hostIntro?: string;
  // Gibberish-specific
  gibberishPhrase?: string;
  hint?: string;
  // DisOrDat-specific
  categoryA?: string;
  categoryB?: string;
  items?: { text: string; correct: 'A' | 'B' }[];
}

export interface PlayerResult {
  playerId: string;
  name: string;
  isCorrect: boolean;
  moneyEarned: number;
  speedBonus: number;
  selectedIndex?: number;
}

export interface ScoreEntry {
  playerId: string;
  name: string;
  money: number;
}

export interface JackAttackWord {
  wordId: string;
  word: string;
  expiresAt: number;
}

export interface JackAttackBuzzResult {
  wordId: string;
  correct: boolean;
  moneyDelta: number;
}

interface GameStore {
  // Connection
  connected: boolean;
  setConnected: (connected: boolean) => void;

  // Room state
  room: ClientGameRoom | null;
  setRoom: (room: ClientGameRoom) => void;

  // My player
  myPlayer: Player | null;
  setMyPlayer: (player: Player) => void;

  // Player list mutations
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;

  // Game state
  gameState: string;
  setGameState: (state: string) => void;

  // Current question data
  currentQuestion: UIQuestion | null;
  setCurrentQuestion: (q: UIQuestion | null) => void;

  // Timer
  questionEndsAt: number | null;
  setQuestionEndsAt: (t: number | null) => void;

  // Player answer tracking (who has answered, not what)
  answeredPlayerIds: string[];
  addAnsweredPlayer: (playerId: string) => void;
  clearAnsweredPlayers: () => void;

  // My submitted answer (index) — for MC / Gibberish / ThreeWay
  myAnswerIndex: number | null;
  setMyAnswerIndex: (idx: number | null) => void;

  // DisOrDat: my answers for each item (null = not answered yet)
  disOrDatMyAnswers: ('A' | 'B' | null)[];
  setDisOrDatMyAnswers: (answers: ('A' | 'B' | null)[]) => void;
  setDisOrDatItemAnswer: (itemIndex: number, answer: 'A' | 'B') => void;

  // DisOrDat: correct answers revealed at reveal phase
  disOrDatCorrectAnswers: ('A' | 'B')[] | null;
  setDisOrDatCorrectAnswers: (answers: ('A' | 'B')[] | null) => void;

  // Question reveal data
  correctAnswerIndex: number | null;
  setCorrectAnswerIndex: (idx: number | null) => void;
  playerResults: PlayerResult[];
  setPlayerResults: (results: PlayerResult[]) => void;

  // Scores
  scores: ScoreEntry[];
  setScores: (scores: ScoreEntry[]) => void;

  // Round info
  currentRound: number;
  setCurrentRound: (round: number) => void;
  questionIndex: number;
  setQuestionIndex: (idx: number) => void;
  totalQuestions: number;
  setTotalQuestions: (n: number) => void;

  // Host dialogue
  hostDialogue: string | null;
  setHostDialogue: (text: string | null) => void;

  // Jack Attack state
  jackAttack: { theme: string; clue: string } | null;
  setJackAttack: (ja: { theme: string; clue: string } | null) => void;
  jackAttackCurrentWord: JackAttackWord | null;
  setJackAttackCurrentWord: (word: JackAttackWord | null) => void;
  jackAttackBuzzResults: JackAttackBuzzResult[];
  addJackAttackBuzzResult: (result: JackAttackBuzzResult) => void;
  jackAttackFinalScores: ScoreEntry[];
  setJackAttackFinalScores: (scores: ScoreEntry[]) => void;

  // Game over data
  finalScores: ScoreEntry[];
  setFinalScores: (scores: ScoreEntry[]) => void;
  gameOverHostScript: string | null;
  setGameOverHostScript: (script: string | null) => void;

  // Loading progress
  loadingProgress: { completed: number; total: number; message: string } | null;
  setLoadingProgress: (progress: { completed: number; total: number; message: string } | null) => void;

  // Error handling
  error: string | null;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Reset
  reset: () => void;
}

const initialState = {
  connected: false,
  room: null,
  myPlayer: null,
  gameState: 'lobby',
  currentQuestion: null,
  questionEndsAt: null,
  answeredPlayerIds: [] as string[],
  myAnswerIndex: null,
  disOrDatMyAnswers: [] as ('A' | 'B' | null)[],
  disOrDatCorrectAnswers: null,
  correctAnswerIndex: null,
  playerResults: [] as PlayerResult[],
  scores: [] as ScoreEntry[],
  currentRound: 1,
  questionIndex: 0,
  totalQuestions: 10,
  hostDialogue: null,
  jackAttack: null,
  jackAttackCurrentWord: null,
  jackAttackBuzzResults: [] as JackAttackBuzzResult[],
  jackAttackFinalScores: [] as ScoreEntry[],
  finalScores: [] as ScoreEntry[],
  gameOverHostScript: null,
  loadingProgress: null,
  error: null,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setConnected: (connected) => set({ connected }),

  setRoom: (room) => set({ room, gameState: room.state }),

  setMyPlayer: (player) => set({ myPlayer: player }),

  addPlayer: (player) =>
    set((state) => {
      if (!state.room) return state;
      const exists = state.room.players.some((p) => p.id === player.id);
      if (exists) return state;
      return {
        room: {
          ...state.room,
          players: [...state.room.players, player],
        },
      };
    }),

  removePlayer: (playerId) =>
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          players: state.room.players.filter((p) => p.id !== playerId),
        },
      };
    }),

  setGameState: (gameState) =>
    set((state) => ({
      gameState,
      room: state.room ? { ...state.room, state: gameState } : null,
    })),

  currentQuestion: null,
  setCurrentQuestion: (currentQuestion) => set({ currentQuestion }),

  questionEndsAt: null,
  setQuestionEndsAt: (questionEndsAt) => set({ questionEndsAt }),

  answeredPlayerIds: [],
  addAnsweredPlayer: (playerId) =>
    set((state) => ({
      answeredPlayerIds: state.answeredPlayerIds.includes(playerId)
        ? state.answeredPlayerIds
        : [...state.answeredPlayerIds, playerId],
    })),
  clearAnsweredPlayers: () =>
    set({ answeredPlayerIds: [], myAnswerIndex: null, disOrDatMyAnswers: [] }),

  myAnswerIndex: null,
  setMyAnswerIndex: (myAnswerIndex) => set({ myAnswerIndex }),

  disOrDatMyAnswers: [],
  setDisOrDatMyAnswers: (disOrDatMyAnswers) => set({ disOrDatMyAnswers }),
  setDisOrDatItemAnswer: (itemIndex, answer) =>
    set((state) => {
      const updated = [...state.disOrDatMyAnswers];
      updated[itemIndex] = answer;
      return { disOrDatMyAnswers: updated };
    }),

  disOrDatCorrectAnswers: null,
  setDisOrDatCorrectAnswers: (disOrDatCorrectAnswers) => set({ disOrDatCorrectAnswers }),

  correctAnswerIndex: null,
  setCorrectAnswerIndex: (correctAnswerIndex) => set({ correctAnswerIndex }),
  playerResults: [],
  setPlayerResults: (playerResults) => set({ playerResults }),

  scores: [],
  setScores: (scores) => set({ scores }),

  currentRound: 1,
  setCurrentRound: (currentRound) => set({ currentRound }),
  questionIndex: 0,
  setQuestionIndex: (questionIndex) => set({ questionIndex }),
  totalQuestions: 10,
  setTotalQuestions: (totalQuestions) => set({ totalQuestions }),

  hostDialogue: null,
  setHostDialogue: (hostDialogue) => set({ hostDialogue }),

  jackAttack: null,
  setJackAttack: (jackAttack) => set({ jackAttack }),
  jackAttackCurrentWord: null,
  setJackAttackCurrentWord: (jackAttackCurrentWord) => set({ jackAttackCurrentWord }),
  jackAttackBuzzResults: [],
  addJackAttackBuzzResult: (result) =>
    set((state) => ({
      jackAttackBuzzResults: [...state.jackAttackBuzzResults, result],
    })),
  jackAttackFinalScores: [],
  setJackAttackFinalScores: (jackAttackFinalScores) => set({ jackAttackFinalScores }),

  finalScores: [],
  setFinalScores: (finalScores) => set({ finalScores }),
  gameOverHostScript: null,
  setGameOverHostScript: (gameOverHostScript) => set({ gameOverHostScript }),

  loadingProgress: null,
  setLoadingProgress: (loadingProgress) => set({ loadingProgress }),

  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}));
