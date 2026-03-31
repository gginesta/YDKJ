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
  markDisconnected,
  toClientRoom,
} from '../game-engine/room-manager';
import { GameEngine } from '../game-engine/game-engine';

export type AppSocket = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

let io: AppSocket | null = null;

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
        const { room, player } = createRoom(playerName, socket.id);
        socket.join(room.id);
        socket.emit('room_created', { room: toClientRoom(room), player });
        console.log(`[Socket] Room ${room.id} created by ${playerName}`);
      } catch (err) {
        socket.emit('error', { message: (err as Error).message });
      }
    });

    // ---- Join Room ----
    socket.on('join_room', ({ roomCode, playerName }) => {
      try {
        const { room, player } = joinRoom(roomCode, playerName, socket.id);
        socket.join(room.id);
        socket.emit('room_joined', { room: toClientRoom(room), player });
        socket.to(room.id).emit('player_joined', { player });
        console.log(`[Socket] ${playerName} joined room ${room.id}`);
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
    socket.on('submit_answer', ({ questionId, answerIndex, timestamp }) => {
      const result = getRoomBySocketId(socket.id);
      if (!result) return;

      const engine = activeGames.get(result.roomCode);
      if (!engine) return;

      engine.submitAnswer(socket.id, questionId, answerIndex, timestamp);
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

    // ---- Rejoin Room (reconnection after disconnect) ----
    socket.on('rejoin_room', ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
      try {
        const room = getRoom(roomCode);
        if (!room) {
          socket.emit('error', { message: 'Room no longer exists.' });
          return;
        }

        // Find the disconnected player by name
        const player = room.players.find(
          (p) => p.name.toLowerCase() === playerName.toLowerCase() && !p.connected
        );

        if (!player) {
          socket.emit('error', { message: 'Could not rejoin — player not found or already connected.' });
          return;
        }

        // Reconnect: update socket ID and mark as connected
        const oldId = player.id;
        player.id = socket.id;
        player.connected = true;
        socket.join(room.id);

        // Send full room state to the reconnected player
        socket.emit('room_joined', { room: toClientRoom(room), player });

        // Notify others
        socket.to(room.id).emit('player_joined', { player });

        console.log(`[Socket] ${playerName} rejoined room ${room.id} (was ${oldId}, now ${socket.id})`);
      } catch (err) {
        socket.emit('error', { message: (err as Error).message });
      }
    });

    // ---- Leave Room (intentional) ----
    socket.on('leave_room', () => {
      handleLeave(socket);
    });

    // ---- Disconnect ----
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);
      handleDisconnect(socket);
    });
  });

  return io;
}

/**
 * Handle intentional leave — permanently remove player.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleLeave(socket: any) {
  const result = leaveRoom(socket.id);
  if (result && result.room) {
    socket.to(result.roomCode).emit('player_left', {
      playerId: socket.id,
      reason: 'left',
    });
  }
  if (result && !result.room) {
    const engine = activeGames.get(result.roomCode);
    if (engine) {
      engine.destroy();
      activeGames.delete(result.roomCode);
    }
  }
}

/**
 * Handle disconnect — mark as disconnected during active games,
 * remove during lobby. Allows reconnection within game.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleDisconnect(socket: any) {
  const roomInfo = getRoomBySocketId(socket.id);
  if (!roomInfo) return;

  const { room, roomCode } = roomInfo;

  if (room.state === 'lobby') {
    // In lobby: remove player immediately
    handleLeave(socket);
  } else {
    // In game: mark as disconnected (allow rejoin)
    markDisconnected(socket.id);
    socket.to(roomCode).emit('player_left', {
      playerId: socket.id,
      reason: 'disconnected',
    });
    console.log(`[Socket] Player ${socket.id} marked disconnected in room ${roomCode} (game in progress)`);
  }
}

/**
 * Get the current Socket.io server instance.
 */
export function getIO(): AppSocket | null {
  return io;
}
