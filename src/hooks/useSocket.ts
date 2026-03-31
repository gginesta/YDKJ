'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/types/socket';
import { useGameStore } from '@/stores/gameStore';
import {
  initAudio,
  playCorrectSound,
  playWrongSound,
  playTransitionSound,
  playGameStartSound,
  playRoundTransitionSound,
  playScoreRevealSound,
  playGameOverSound,
  playTapSound,
  speakText,
  stopSpeaking,
} from '@/lib/audio/sound-system';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let globalSocket: AppSocket | null = null;
let currentAudio: HTMLAudioElement | null = null;

/**
 * Play audio from a base64 data URL. Stops any currently playing audio.
 */
function playAudio(audioUrl: string | undefined | null): void {
  if (!audioUrl) return;
  try {
    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    const audio = new Audio(audioUrl);
    currentAudio = audio;
    audio.play().catch(() => {
      // Autoplay blocked — user hasn't interacted yet, silently skip
    });
  } catch {
    // Audio playback failed, text fallback handles it
  }
}

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
      const store = useGameStore.getState();
      store.setConnected(true);

      // Attempt to rejoin if we were in a game
      if (store.room && store.myPlayer && store.gameState !== 'lobby') {
        console.log('[Socket] Reconnected — attempting to rejoin room', store.room.id);
        socket.emit('rejoin_room', {
          roomCode: store.room.id,
          playerName: store.myPlayer.name,
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

    socket.on('game_starting', ({ hostScript, audioUrl }) => {
      const store = useGameStore.getState();
      store.setGameState('game_starting');
      if (hostScript) store.setHostDialogue(hostScript);
      initAudio(); // Ensure audio context is ready
      playGameStartSound();
      if (audioUrl) playAudio(audioUrl);
      else if (hostScript) speakText(hostScript);
    });

    socket.on('question_intro', ({ question, hostScript, audioUrl }) => {
      const store = useGameStore.getState();
      const q = question as Record<string, unknown>;
      store.setGameState('question_intro');
      store.setCurrentQuestion(q as unknown as import('@/stores/gameStore').UIQuestion);
      store.clearAnsweredPlayers();
      store.setCorrectAnswerIndex(null);
      store.setPlayerResults([]);
      store.setQuestionEndsAt(null);
      if (typeof q.questionIndex === 'number') store.setQuestionIndex(q.questionIndex);
      if (typeof q.round === 'number') store.setCurrentRound(q.round);
      if (typeof q.totalQuestions === 'number') store.setTotalQuestions(q.totalQuestions);
      if (hostScript) store.setHostDialogue(hostScript);
      stopSpeaking();
      playTransitionSound();
      if (audioUrl) playAudio(audioUrl);
      else if (hostScript) speakText(hostScript);
    });

    socket.on('question_active', ({ question, timeLimit }) => {
      const store = useGameStore.getState();
      if (store.gameState === 'question_reveal' || store.gameState === 'scores_update') return;
      store.setGameState('question_active');
      store.setCurrentQuestion(question as unknown as import('@/stores/gameStore').UIQuestion);
      store.setQuestionEndsAt(Date.now() + timeLimit * 1000);
      stopSpeaking();
    });

    socket.on('answer_received', ({ playerId }) => {
      useGameStore.getState().addAnsweredPlayer(playerId);
      playTapSound();
    });

    socket.on('question_reveal', ({ correctAnswer, playerResults, hostScript, audioUrl }) => {
      const store = useGameStore.getState();
      store.setGameState('question_reveal');
      store.setCorrectAnswerIndex(correctAnswer);
      store.setPlayerResults(playerResults as unknown as import('@/stores/gameStore').PlayerResult[]);
      if (hostScript) store.setHostDialogue(hostScript);
      // Play correct/wrong sound based on my result
      const myId = store.myPlayer?.id;
      const myResult = (playerResults as unknown as import('@/stores/gameStore').PlayerResult[]).find(
        (r) => r.playerId === myId
      );
      if (myResult?.isCorrect) playCorrectSound();
      else if (myResult && !myResult.isCorrect) playWrongSound();
      if (audioUrl) playAudio(audioUrl);
      else if (hostScript) speakText(hostScript);
    });

    socket.on('scores_update', ({ scores }) => {
      const store = useGameStore.getState();
      store.setGameState('scores_update');
      store.setScores(scores);
      playScoreRevealSound();
    });

    socket.on('round_transition', ({ round, hostScript, audioUrl }) => {
      const store = useGameStore.getState();
      store.setGameState('round_transition');
      store.setCurrentRound(round);
      if (hostScript) store.setHostDialogue(hostScript);
      playRoundTransitionSound();
      if (audioUrl) playAudio(audioUrl);
      else if (hostScript) speakText(hostScript);
    });

    socket.on('game_over', ({ finalScores, hostScript, audioUrl }) => {
      const store = useGameStore.getState();
      store.setGameState('game_over');
      playGameOverSound();
      store.setFinalScores(finalScores);
      if (hostScript) store.setGameOverHostScript(hostScript);
      if (audioUrl) playAudio(audioUrl);
      else if (hostScript) setTimeout(() => speakText(hostScript), 1500); // Wait for game over sound
    });

    socket.on('loading_progress', (data) => {
      useGameStore.getState().setLoadingProgress(data);
    });

    socket.on('host_audio', ({ audioUrl }) => {
      playAudio(audioUrl);
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
      socket.off('game_over');
      socket.off('loading_progress');
      socket.off('host_audio');
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
    playAgain,
    connected,
  };
}
