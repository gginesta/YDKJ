import { create } from 'zustand';
import type { Player } from '@/types/game';
import type { ClientGameRoom } from '@/types/socket';

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

  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}));
