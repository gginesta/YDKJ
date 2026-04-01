import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../types/socket';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  markDisconnected,
  startGame,
  getRoom,
  getRoomBySocketId,
  toClientRoom,
} from '../game-engine/room-manager';
import { GameEngine } from '../game-engine/game-engine';
import { GameState } from '../../types/game';

export type AppSocket = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

let io: AppSocket | null = null;

// Active game engines, keyed by room code
const activeGames = new Map<string, GameEngine>();

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

    // ---- Rejoin Room (after disconnect) ----
    socket.on('rejoin_room', ({ roomCode, playerName }) => {
      try {
        const room = getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        // Find disconnected player by name
        const player = room.players.find(
          (p) => p.name.toLowerCase() === playerName.toLowerCase() && !p.connected
        );
        if (!player) {
          // Player not found as disconnected — try joining fresh if in lobby
          if (room.state === GameState.LOBBY) {
            const result = joinRoom(roomCode, playerName, socket.id);
            socket.join(room.id);
            socket.emit('room_joined', { room: toClientRoom(result.room), player: result.player });
          }
          return;
        }

        // Restore player with new socket ID
        const oldId = player.id;
        player.id = socket.id;
        player.connected = true;

        // If this player was the host, update host reference
        if (room.hostPlayerId === oldId) room.hostPlayerId = socket.id;

        socket.join(room.id);
        socket.emit('room_joined', { room: toClientRoom(room), player });
        socket.to(room.id).emit('player_joined', { player });
        console.log(`[Socket] ${playerName} rejoined room ${room.id} (was ${oldId}, now ${socket.id})`);
      } catch (err) {
        socket.emit('error', { message: (err as Error).message });
      }
    });

    // ---- Start Game ----
    socket.on('start_game', ({ roomCode }) => {
      try {
        const room = startGame(roomCode, socket.id);
        const engine = new GameEngine(io!, room, room.id);
        activeGames.set(room.id, engine);
        engine.start();
        console.log(`[Socket] Game started in room ${room.id}`);
      } catch (err) {
        socket.emit('error', { message: (err as Error).message });
      }
    });

    // ---- Submit Answer (MC / Gibberish / ThreeWay) ----
    socket.on('submit_answer', ({ questionId, answerIndex, timestamp }) => {
      const result = getRoomBySocketId(socket.id);
      if (!result) return;
      const engine = activeGames.get(result.roomCode);
      if (!engine) return;
      engine.submitAnswer(socket.id, questionId, answerIndex, timestamp);
    });

    // ---- Submit Dis or Dat Answers ----
    socket.on('submit_dis_or_dat', ({ questionId, answers }) => {
      const result = getRoomBySocketId(socket.id);
      if (!result) return;
      const engine = activeGames.get(result.roomCode);
      if (!engine) return;
      engine.submitDisOrDat(socket.id, questionId, answers);
    });

    // ---- Jack Attack Buzz ----
    socket.on('jack_attack_buzz', ({ wordId }) => {
      const result = getRoomBySocketId(socket.id);
      if (!result) return;
      const engine = activeGames.get(result.roomCode);
      if (!engine) return;
      engine.submitJackAttackBuzz(socket.id, wordId);
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

      const room = getRoom(result.roomCode);
      if (room) {
        io!.to(result.roomCode).emit('room_joined', {
          room: toClientRoom(room),
          player: room.players.find((p) => p.id === socket.id)!,
        });
      }
    });

    // ---- Leave Room (intentional) ----
    socket.on('leave_room', () => {
      handleLeave(socket, true);
    });

    // ---- Disconnect ----
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);
      handleLeave(socket, false);
    });
  });

  return io;
}

/**
 * Handle leave/disconnect. During active games, unintentional disconnects
 * mark the player as disconnected (allowing rejoin). Intentional leaves
 * and lobby disconnects remove permanently.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleLeave(socket: any, intentional: boolean) {
  const result = getRoomBySocketId(socket.id);
  if (!result) return;

  const room = result.room;
  const isInGame = room.state !== GameState.LOBBY;

  if (isInGame && !intentional) {
    // During a game: mark disconnected, don't remove
    markDisconnected(socket.id);
    const engine = activeGames.get(result.roomCode);
    if (engine) engine.markPlayerDisconnected(socket.id);
    console.log(`[Socket] Player ${socket.id} disconnected mid-game — marked disconnected`);
    return;
  }

  // Lobby disconnect or intentional leave: remove permanently
  const leaveResult = leaveRoom(socket.id);
  if (leaveResult && leaveResult.room) {
    socket.to(result.roomCode).emit('player_left', {
      playerId: socket.id,
      reason: intentional ? 'left' : 'disconnected',
    });
  }

  if (leaveResult && !leaveResult.room) {
    const engine = activeGames.get(result.roomCode);
    if (engine) {
      engine.destroy();
      activeGames.delete(result.roomCode);
    }
  }
}

export function getIO(): AppSocket | null {
  return io;
}
