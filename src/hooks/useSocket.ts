'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/types/socket';
import { useGameStore } from '@/stores/gameStore';

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
    });

    socket.on('room_joined', ({ room, player }) => {
      useGameStore.getState().setRoom(room);
      useGameStore.getState().setMyPlayer(player);
    });

    socket.on('player_joined', ({ player }) => {
      useGameStore.getState().addPlayer(player);
    });

    socket.on('player_left', ({ playerId }) => {
      useGameStore.getState().removePlayer(playerId);
    });

    socket.on('game_starting', ({ hostScript }) => {
      const store = useGameStore.getState();
      store.setGameState('game_starting');
      if (hostScript) store.setHostDialogue(hostScript);
    });

    socket.on('question_intro', ({ question, hostScript }) => {
      const store = useGameStore.getState();
      store.setGameState('question_intro');
      store.setCurrentQuestion(question as unknown as import('@/stores/gameStore').UIQuestion);
      store.clearAnsweredPlayers();
      store.setCorrectAnswerIndex(null);
      store.setDisOrDatCorrectAnswers(null);
      store.setPlayerResults([]);
      store.setQuestionEndsAt(null);
      // Update question index if provided
      const q = question as Record<string, unknown>;
      if (typeof q.questionIndex === 'number') store.setQuestionIndex(q.questionIndex);
      if (hostScript) store.setHostDialogue(hostScript);
    });

    socket.on('question_active', ({ question, timeLimit }) => {
      const store = useGameStore.getState();
      store.setGameState('question_active');
      store.setCurrentQuestion(question as unknown as import('@/stores/gameStore').UIQuestion);
      store.setQuestionEndsAt(Date.now() + timeLimit * 1000);
    });

    socket.on('answer_received', ({ playerId }) => {
      useGameStore.getState().addAnsweredPlayer(playerId);
    });

    socket.on('question_reveal', ({ correctAnswer, disOrDatCorrect, playerResults, hostScript }) => {
      const store = useGameStore.getState();
      store.setGameState('question_reveal');
      store.setCorrectAnswerIndex(correctAnswer);
      if (disOrDatCorrect) store.setDisOrDatCorrectAnswers(disOrDatCorrect);
      store.setPlayerResults(playerResults as unknown as import('@/stores/gameStore').PlayerResult[]);
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

    // ---- Jack Attack events ----
    socket.on('jack_attack_intro', ({ theme, clue, hostScript }) => {
      const store = useGameStore.getState();
      store.setGameState('jack_attack_intro');
      store.setJackAttack({ theme, clue });
      store.setJackAttackCurrentWord(null);
      // Clear any previous buzz results
      store.setJackAttackFinalScores([]);
      if (hostScript) store.setHostDialogue(hostScript);
    });

    socket.on('jack_attack_word', ({ wordId, word, expiresAt }) => {
      const store = useGameStore.getState();
      store.setGameState('jack_attack_active');
      store.setJackAttackCurrentWord({ wordId, word, expiresAt });
    });

    socket.on('jack_attack_buzz_result', ({ playerId, wordId, correct, moneyDelta }) => {
      const myPlayer = useGameStore.getState().myPlayer;
      if (playerId === myPlayer?.id) {
        useGameStore.getState().addJackAttackBuzzResult({ wordId, correct, moneyDelta });
      }
    });

    socket.on('jack_attack_end', ({ scores, hostScript }) => {
      const store = useGameStore.getState();
      store.setGameState('jack_attack_results');
      store.setJackAttackFinalScores(scores);
      if (hostScript) store.setHostDialogue(hostScript);
    });

    socket.on('game_over', ({ finalScores, hostScript }) => {
      const store = useGameStore.getState();
      store.setGameState('game_over');
      store.setFinalScores(finalScores);
      if (hostScript) store.setGameOverHostScript(hostScript);
    });

    socket.on('loading_progress', ({ stage, percent, message }) => {
      useGameStore.getState().setLoadingProgress({ stage, percent, message });
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
      socket.off('game_starting');
      socket.off('question_intro');
      socket.off('question_active');
      socket.off('answer_received');
      socket.off('question_reveal');
      socket.off('scores_update');
      socket.off('round_transition');
      socket.off('jack_attack_intro');
      socket.off('jack_attack_word');
      socket.off('jack_attack_buzz_result');
      socket.off('jack_attack_end');
      socket.off('game_over');
      socket.off('loading_progress');
      socket.off('error');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    useGameStore.getState().reset();
  }, []);

  const submitAnswer = useCallback((questionId: string, answerIndex: number) => {
    socketRef.current?.emit('submit_answer', {
      questionId,
      answerIndex,
      timestamp: Date.now(),
    });
    useGameStore.getState().setMyAnswerIndex(answerIndex);
  }, []);

  const submitDisOrDat = useCallback((questionId: string, answers: ('A' | 'B' | null)[]) => {
    socketRef.current?.emit('submit_dis_or_dat', { questionId, answers });
  }, []);

  const submitJackAttackBuzz = useCallback((wordId: string) => {
    socketRef.current?.emit('jack_attack_buzz', { wordId, timestamp: Date.now() });
  }, []);

  const playAgain = useCallback(() => {
    socketRef.current?.emit('play_again');
  }, []);

  return {
    socket: socketRef.current,
    createRoom,
    joinRoom,
    startGame,
    leaveRoom,
    submitAnswer,
    submitDisOrDat,
    submitJackAttackBuzz,
    playAgain,
    connected,
  };
}
