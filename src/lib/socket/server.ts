import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../types/socket';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  startGame,
  toClientRoom,
} from '../game-engine/room-manager';

export type AppSocket = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

let io: AppSocket | null = null;

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
        // Notify others in the room
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
        io!.to(room.id).emit('game_starting', {
          hostScript: 'Welcome to You Don\'t Know Jack! Let\'s get this show on the road!',
        });
        console.log(`[Socket] Game started in room ${room.id}`);
      } catch (err) {
        socket.emit('error', { message: (err as Error).message });
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

function handleLeave(socket: { id: string; to: (room: string) => { emit: (event: string, data: unknown) => void } }) {
  const result = leaveRoom(socket.id);
  if (result && result.room) {
    socket.to(result.roomCode).emit('player_left', {
      playerId: socket.id,
      reason: 'left',
    });
  }
}

/**
 * Get the current Socket.io server instance.
 */
export function getIO(): AppSocket | null {
  return io;
}
