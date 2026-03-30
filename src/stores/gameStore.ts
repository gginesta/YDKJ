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
  prompt?: string;
  choices?: string[];
  hostIntro?: string;
  // DisOrDat fields
  categoryA?: string;
  categoryB?: string;
  items?: { text: string; correct: 'A' | 'B' }[];
  // Gibberish fields
  gibberishPhrase?: string;
  hint?: string;
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

  // My submitted answer (index)
  myAnswerIndex: number | null;
  setMyAnswerIndex: (idx: number | null) => void;

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
  correctAnswerIndex: null,
  playerResults: [] as PlayerResult[],
  scores: [] as ScoreEntry[],
  currentRound: 1,
  questionIndex: 0,
  totalQuestions: 10,
  hostDialogue: null,
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
      // Avoid duplicates
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

  // Current question
  currentQuestion: null,
  setCurrentQuestion: (currentQuestion) => set({ currentQuestion }),

  // Timer
  questionEndsAt: null,
  setQuestionEndsAt: (questionEndsAt) => set({ questionEndsAt }),

  // Answer tracking
  answeredPlayerIds: [],
  addAnsweredPlayer: (playerId) =>
    set((state) => ({
      answeredPlayerIds: state.answeredPlayerIds.includes(playerId)
        ? state.answeredPlayerIds
        : [...state.answeredPlayerIds, playerId],
    })),
  clearAnsweredPlayers: () => set({ answeredPlayerIds: [], myAnswerIndex: null }),

  // My answer
  myAnswerIndex: null,
  setMyAnswerIndex: (myAnswerIndex) => set({ myAnswerIndex }),

  // Reveal
  correctAnswerIndex: null,
  setCorrectAnswerIndex: (correctAnswerIndex) => set({ correctAnswerIndex }),
  playerResults: [],
  setPlayerResults: (playerResults) => set({ playerResults }),

  // Scores
  scores: [],
  setScores: (scores) => set({ scores }),

  // Round info
  currentRound: 1,
  setCurrentRound: (currentRound) => set({ currentRound }),
  questionIndex: 0,
  setQuestionIndex: (questionIndex) => set({ questionIndex }),
  totalQuestions: 10,
  setTotalQuestions: (totalQuestions) => set({ totalQuestions }),

  // Host dialogue
  hostDialogue: null,
  setHostDialogue: (hostDialogue) => set({ hostDialogue }),

  // Game over
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
