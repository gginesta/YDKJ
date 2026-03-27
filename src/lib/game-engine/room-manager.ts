import { GameRoom, GameState, Player } from '../../types/game';

// Characters excluding ambiguous O, I, L
const ROOM_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const ROOM_CODE_LENGTH = 4;
const MAX_PLAYERS = 10;
const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// In-memory room store
const rooms = new Map<string, GameRoom>();

// Cleanup interval handle
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Generate a random 4-letter room code (no ambiguous chars).
 * Retries if code already exists.
 */
function generateRoomCode(): string {
  let code: string;
  let attempts = 0;
  do {
    code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
    }
    attempts++;
    if (attempts > 100) {
      throw new Error('Unable to generate unique room code');
    }
  } while (rooms.has(code));
  return code;
}

/**
 * Create a new game room. Returns the room and the host player.
 */
export function createRoom(playerName: string, socketId: string): { room: GameRoom; player: Player } {
  const roomCode = generateRoomCode();
  const playerId = socketId;

  const player: Player = {
    id: playerId,
    name: playerName,
    money: 0,
    streak: 0,
    powerUps: [],
    answers: [],
    connected: true,
    joinedAt: Date.now(),
  };

  const room: GameRoom = {
    id: roomCode,
    hostPlayerId: playerId,
    players: [player],
    state: GameState.LOBBY,
    round: 1,
    questionIndex: 0,
    questions: [],
    jackAttack: null,
    createdAt: Date.now(),
  };

  rooms.set(roomCode, room);
  return { room, player };
}

/**
 * Join an existing room. Validates code, capacity, and game state.
 */
export function joinRoom(
  roomCode: string,
  playerName: string,
  socketId: string
): { room: GameRoom; player: Player } {
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);

  if (!room) {
    throw new Error('Room not found. Check your code and try again.');
  }

  if (room.state !== GameState.LOBBY) {
    throw new Error('Game already in progress. Cannot join.');
  }

  if (room.players.length >= MAX_PLAYERS) {
    throw new Error('Room is full (max 10 players).');
  }

  // Check for duplicate names
  const nameTaken = room.players.some(
    (p) => p.name.toLowerCase() === playerName.toLowerCase()
  );
  if (nameTaken) {
    throw new Error('That name is already taken in this room.');
  }

  const player: Player = {
    id: socketId,
    name: playerName,
    money: 0,
    streak: 0,
    powerUps: [],
    answers: [],
    connected: true,
    joinedAt: Date.now(),
  };

  room.players.push(player);
  return { room, player };
}

/**
 * Remove a player from their room. Returns the room (or null if deleted).
 */
export function leaveRoom(socketId: string): { room: GameRoom | null; roomCode: string } | null {
  for (const [code, room] of rooms.entries()) {
    const playerIndex = room.players.findIndex((p) => p.id === socketId);
    if (playerIndex === -1) continue;

    room.players.splice(playerIndex, 1);

    // If no players left, delete the room
    if (room.players.length === 0) {
      rooms.delete(code);
      return { room: null, roomCode: code };
    }

    // If host left, reassign to next player
    if (room.hostPlayerId === socketId) {
      room.hostPlayerId = room.players[0].id;
    }

    return { room, roomCode: code };
  }

  return null;
}

/**
 * Mark a player as disconnected (for reconnection grace period).
 */
export function markDisconnected(socketId: string): { room: GameRoom; roomCode: string } | null {
  for (const [code, room] of rooms.entries()) {
    const player = room.players.find((p) => p.id === socketId);
    if (player) {
      player.connected = false;
      return { room, roomCode: code };
    }
  }
  return null;
}

/**
 * Get a room by code.
 */
export function getRoom(roomCode: string): GameRoom | undefined {
  return rooms.get(roomCode.toUpperCase());
}

/**
 * Get the room a specific socket is in.
 */
export function getRoomBySocketId(socketId: string): { room: GameRoom; roomCode: string } | null {
  for (const [code, room] of rooms.entries()) {
    if (room.players.some((p) => p.id === socketId)) {
      return { room, roomCode: code };
    }
  }
  return null;
}

/**
 * Start the game in a room. Validates host and minimum players.
 */
export function startGame(roomCode: string, socketId: string): GameRoom {
  const room = rooms.get(roomCode.toUpperCase());
  if (!room) throw new Error('Room not found.');
  if (room.hostPlayerId !== socketId) throw new Error('Only the host can start the game.');
  if (room.players.length < 2) throw new Error('Need at least 2 players to start.');
  if (room.state !== GameState.LOBBY) throw new Error('Game already started.');

  room.state = GameState.GAME_STARTING;
  room.startedAt = Date.now();
  return room;
}

/**
 * Clean up rooms that have been inactive for > ROOM_TTL_MS.
 */
export function cleanupStaleRooms(): number {
  const now = Date.now();
  let cleaned = 0;
  for (const [code, room] of rooms.entries()) {
    const lastActivity = room.startedAt || room.createdAt;
    if (now - lastActivity > ROOM_TTL_MS) {
      rooms.delete(code);
      cleaned++;
    }
  }
  return cleaned;
}

/**
 * Start the auto-cleanup interval (runs every 30 minutes).
 */
export function startCleanupInterval(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const cleaned = cleanupStaleRooms();
    if (cleaned > 0) {
      console.log(`[RoomManager] Cleaned up ${cleaned} stale room(s)`);
    }
  }, 30 * 60 * 1000);
}

/**
 * Stop the auto-cleanup interval.
 */
export function stopCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Get a client-safe view of a room (strip server-only data like question answers).
 */
export function toClientRoom(room: GameRoom) {
  return {
    id: room.id,
    hostPlayerId: room.hostPlayerId,
    players: room.players,
    state: room.state,
    round: room.round,
    questionIndex: room.questionIndex,
    theme: room.theme,
    createdAt: room.createdAt,
    startedAt: room.startedAt,
  };
}

/**
 * Get total active room count (for diagnostics).
 */
export function getRoomCount(): number {
  return rooms.size;
}
