import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../types/socket';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  startGame,
  getRoom,
  getRoomBySocketId,
  toClientRoom,
} from '../game-engine/room-manager';
import { GameEngine } from '../game-engine/game-engine';

export type AppSocket = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

let io: AppSocket | null = null;

/**
 * Sanitize player name: trim, limit length, strip HTML tags.
 */
function sanitizePlayerName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const cleaned = name.trim().replace(/<[^>]*>/g, '').slice(0, 16);
  return cleaned.length > 0 ? cleaned : null;
}

// Active game engines, keyed by room code
const activeGames = new Map<string, GameEngine>();

/**
 * Initialize Socket.io on the given HTTP server.
 */
export function initSocketServer(httpServer: HttpServer): AppSocket {
  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ---- Create Room ----
    socket.on('create_room', ({ playerName }) => {
      try {
        const sanitized = sanitizePlayerName(playerName);
        if (!sanitized) {
          socket.emit('error', { message: 'Invalid player name.' });
          return;
        }
        const { room, player } = createRoom(sanitized, socket.id);
        socket.join(room.id);
        socket.emit('room_created', { room: toClientRoom(room), player });
        console.log(`[Socket] Room ${room.id} created by ${sanitized}`);
      } catch (err) {
        socket.emit('error', { message: (err as Error).message });
      }
    });

    // ---- Join Room ----
    socket.on('join_room', ({ roomCode, playerName }) => {
      try {
        const sanitized = sanitizePlayerName(playerName);
        if (!sanitized) {
          socket.emit('error', { message: 'Invalid player name.' });
          return;
        }
        const { room, player } = joinRoom(roomCode, sanitized, socket.id);
        socket.join(room.id);
        socket.emit('room_joined', { room: toClientRoom(room), player });
        socket.to(room.id).emit('player_joined', { player });
        console.log(`[Socket] ${sanitized} joined room ${room.id}`);
      } catch (err) {
        socket.emit('error', { message: (err as Error).message });
      }
    });

    // ---- Start Game ----
    socket.on('start_game', ({ roomCode }) => {
      try {
        const room = startGame(roomCode, socket.id);

        // Create and start the game engine
        const engine = new GameEngine(io!, room, room.id);
        activeGames.set(room.id, engine);
        engine.start();

        console.log(`[Socket] Game started in room ${room.id}`);
      } catch (err) {
        socket.emit('error', { message: (err as Error).message });
      }
    });

    // ---- Submit Answer ----
    socket.on('submit_answer', ({ questionId, answerIndex }) => {
      const result = getRoomBySocketId(socket.id);
      if (!result) return;

      const engine = activeGames.get(result.roomCode);
      if (!engine) return;

      // Validate answerIndex is a non-negative integer within bounds
      if (typeof answerIndex !== 'number' || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
        socket.emit('error', { message: 'Invalid answer.' });
        return;
      }

      // Use server timestamp to prevent client-side speed bonus manipulation
      engine.submitAnswer(socket.id, questionId, answerIndex, Date.now());
    });

    // ---- Play Again ----
    socket.on('play_again', () => {
      const result = getRoomBySocketId(socket.id);
      if (!result) return;

      const engine = activeGames.get(result.roomCode);
      if (engine) {
        engine.resetForPlayAgain();
        activeGames.delete(result.roomCode);
      }

      // Broadcast return to lobby
      const room = getRoom(result.roomCode);
      if (room) {
        io!.to(result.roomCode).emit('room_joined', {
          room: toClientRoom(room),
          player: room.players.find((p) => p.id === socket.id)!,
        });
      }
    });

    // ---- Leave Room ----
    socket.on('leave_room', () => {
      handleLeave(socket);
    });

    // ---- Disconnect ----
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);
      handleLeave(socket);
    });
  });

  return io;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleLeave(socket: any) {
  const result = leaveRoom(socket.id);
  if (result && result.room) {
    socket.to(result.roomCode).emit('player_left', {
      playerId: socket.id,
      reason: 'left',
    });
  }
  // Clean up game engine if room was deleted
  if (result && !result.room) {
    const engine = activeGames.get(result.roomCode);
    if (engine) {
      engine.destroy();
      activeGames.delete(result.roomCode);
    }
  }
}

/**
 * Get the current Socket.io server instance.
 */
export function getIO(): AppSocket | null {
  return io;
}
