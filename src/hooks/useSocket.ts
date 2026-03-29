'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/types/socket';
import { useGameStore } from '@/stores/gameStore';
import type { UIQuestion, PlayerResult } from '@/stores/gameStore';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let globalSocket: AppSocket | null = null;

function getSocket(): AppSocket {
  if (!globalSocket) {
    globalSocket = io({
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return globalSocket;
}

// ============================================================
// Session persistence (localStorage)
// ============================================================

const SESSION_KEY = 'ydkj_session';
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours (matches room TTL)

interface StoredSession {
  roomCode: string;
  playerId: string;
  playerName: string;
  timestamp: number;
}

function saveSession(data: Omit<StoredSession, 'timestamp'>): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...data, timestamp: Date.now() }));
  } catch { /* localStorage unavailable */ }
}

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredSession;
    if (Date.now() - data.timestamp > SESSION_TTL_MS) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return data;
  } catch { return null; }
}

function clearSession(): void {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
}

// ============================================================
// Hook
// ============================================================

export function useSocket() {
  const socketRef = useRef<AppSocket | null>(null);
  const connected = useGameStore((s) => s.connected);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    if (!socket.connected) {
      socket.connect();
    }

    // Track connection state
    socket.on('connect', () => {
      useGameStore.getState().setConnected(true);

      // Attempt reconnection if we have a stored session but no active room
      const session = loadSession();
      if (session && !useGameStore.getState().room) {
        console.log('[Socket] Attempting reconnect to room', session.roomCode);
        socket.emit('reconnect_attempt', {
          roomCode: session.roomCode,
          playerId: session.playerId,
        });
      }
    });

    socket.on('disconnect', () => {
      useGameStore.getState().setConnected(false);
    });

    // If already connected, set state
    if (socket.connected) {
      useGameStore.getState().setConnected(true);
    }

    // ---- Server event handlers ----
    socket.on('room_created', ({ room, player }) => {
      useGameStore.getState().setRoom(room);
      useGameStore.getState().setMyPlayer(player);
      saveSession({ roomCode: room.id, playerId: player.id, playerName: player.name });
    });

    socket.on('room_joined', ({ room, player }) => {
      useGameStore.getState().setRoom(room);
      useGameStore.getState().setMyPlayer(player);
      saveSession({ roomCode: room.id, playerId: player.id, playerName: player.name });
    });

    socket.on('player_joined', ({ player }) => {
      useGameStore.getState().addPlayer(player);
    });

    socket.on('player_left', ({ playerId }) => {
      useGameStore.getState().removePlayer(playerId);
    });

    socket.on('player_disconnected', ({ playerId }) => {
      useGameStore.getState().setPlayerConnected(playerId, false);
    });

    socket.on('player_reconnected', ({ playerId, newPlayerId }) => {
      const store = useGameStore.getState();
      // Remap the player ID if it changed (old socket ID -> new socket ID)
      if (playerId !== newPlayerId) {
        store.remapPlayerId(playerId, newPlayerId);
      } else {
        store.setPlayerConnected(playerId, true);
      }
    });

    socket.on('reconnect_success', ({ room, player, gameSnapshot }) => {
      const store = useGameStore.getState();
      store.setRoom(room);
      store.setMyPlayer(player);
      saveSession({ roomCode: room.id, playerId: player.id, playerName: player.name });

      // Restore game state from snapshot
      if (gameSnapshot) {
        store.setGameState(gameSnapshot.gameState);
        if (gameSnapshot.currentQuestion) {
          store.setCurrentQuestion(gameSnapshot.currentQuestion as unknown as UIQuestion);
        }
        if (gameSnapshot.questionTimeRemainingMs !== null && gameSnapshot.questionTimeRemainingMs > 0) {
          store.setQuestionEndsAt(Date.now() + gameSnapshot.questionTimeRemainingMs);
        }
        gameSnapshot.answeredPlayerIds.forEach((id) => store.addAnsweredPlayer(id));
        store.setScores(gameSnapshot.scores);
        store.setCurrentRound(gameSnapshot.currentRound);
        store.setQuestionIndex(gameSnapshot.questionIndex);
        store.setTotalQuestions(gameSnapshot.totalQuestions);
        if (gameSnapshot.correctAnswerIndex !== null) {
          store.setCorrectAnswerIndex(gameSnapshot.correctAnswerIndex);
        }
        if (gameSnapshot.playerResults.length > 0) {
          store.setPlayerResults(gameSnapshot.playerResults as unknown as PlayerResult[]);
        }
        if (gameSnapshot.finalScores.length > 0) {
          store.setFinalScores(gameSnapshot.finalScores);
        }
        if (gameSnapshot.gameOverHostScript) {
          store.setGameOverHostScript(gameSnapshot.gameOverHostScript);
        }
        if (gameSnapshot.hostDialogue) {
          store.setHostDialogue(gameSnapshot.hostDialogue);
        }
      }

      console.log('[Socket] Reconnected successfully');
    });

    socket.on('reconnect_failed', ({ reason }) => {
      clearSession();
      console.log('[Socket] Reconnect failed:', reason);
    });

    socket.on('game_starting', ({ hostScript }) => {
      const store = useGameStore.getState();
      store.setGameState('game_starting');
      if (hostScript) store.setHostDialogue(hostScript);
    });

    socket.on('question_intro', ({ question, hostScript }) => {
      const store = useGameStore.getState();
      store.setGameState('question_intro');
      store.setCurrentQuestion(question as unknown as UIQuestion);
      store.clearAnsweredPlayers();
      store.setCorrectAnswerIndex(null);
      store.setPlayerResults([]);
      store.setQuestionEndsAt(null);
      if (hostScript) store.setHostDialogue(hostScript);
    });

    socket.on('question_active', ({ question, timeLimit }) => {
      const store = useGameStore.getState();
      store.setGameState('question_active');
      store.setCurrentQuestion(question as unknown as UIQuestion);
      store.setQuestionEndsAt(Date.now() + timeLimit * 1000);
    });

    socket.on('answer_received', ({ playerId }) => {
      useGameStore.getState().addAnsweredPlayer(playerId);
    });

    socket.on('question_reveal', ({ correctAnswer, playerResults, hostScript }) => {
      const store = useGameStore.getState();
      store.setGameState('question_reveal');
      store.setCorrectAnswerIndex(correctAnswer);
      store.setPlayerResults(playerResults as unknown as PlayerResult[]);
      if (hostScript) store.setHostDialogue(hostScript);
    });

    socket.on('scores_update', ({ scores }) => {
      const store = useGameStore.getState();
      store.setGameState('scores_update');
      store.setScores(scores);
    });

    socket.on('round_transition', ({ round, hostScript }) => {
      const store = useGameStore.getState();
      store.setGameState('round_transition');
      store.setCurrentRound(round);
      if (hostScript) store.setHostDialogue(hostScript);
    });

    socket.on('game_over', ({ finalScores, hostScript }) => {
      const store = useGameStore.getState();
      store.setGameState('game_over');
      store.setFinalScores(finalScores);
      if (hostScript) store.setGameOverHostScript(hostScript);
    });

    socket.on('error', ({ message }) => {
      useGameStore.getState().setError(message);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('player_joined');
      socket.off('player_left');
      socket.off('player_disconnected');
      socket.off('player_reconnected');
      socket.off('reconnect_success');
      socket.off('reconnect_failed');
      socket.off('game_starting');
      socket.off('question_intro');
      socket.off('question_active');
      socket.off('answer_received');
      socket.off('question_reveal');
      socket.off('scores_update');
      socket.off('round_transition');
      socket.off('game_over');
      socket.off('error');
    };
  }, []);

  const createRoom = useCallback((playerName: string) => {
    socketRef.current?.emit('create_room', { playerName });
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string) => {
    socketRef.current?.emit('join_room', { roomCode, playerName });
  }, []);

  const startGame = useCallback((roomCode: string) => {
    socketRef.current?.emit('start_game', { roomCode });
  }, []);

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit('leave_room');
    clearSession();
    useGameStore.getState().reset();
  }, []);

  const submitAnswer = useCallback((questionId: string, answerIndex: number) => {
    socketRef.current?.emit('submit_answer', {
      questionId,
      answerIndex,
      timestamp: 0, // Server uses its own timestamp for scoring fairness
    });
    useGameStore.getState().setMyAnswerIndex(answerIndex);
  }, []);

  const playAgain = useCallback(() => {
    socketRef.current?.emit('play_again');
  }, []);

  return {
    createRoom,
    joinRoom,
    startGame,
    leaveRoom,
    submitAnswer,
    playAgain,
    connected,
  };
}
