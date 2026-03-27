'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/stores/gameStore';
import GameStarting from '@/components/game/GameStarting';
import QuestionCard from '@/components/game/QuestionCard';
import Scoreboard from '@/components/game/Scoreboard';
import RoundTransition from '@/components/game/RoundTransition';
import GameOver from '@/components/game/GameOver';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const { startGame, leaveRoom } = useSocket();
  const room = useGameStore((s) => s.room);
  const myPlayer = useGameStore((s) => s.myPlayer);
  const gameState = useGameStore((s) => s.gameState);
  const error = useGameStore((s) => s.error);
  const clearError = useGameStore((s) => s.clearError);

  const roomId = params.roomId as string;

  // If user navigated here directly without a room, send them home
  useEffect(() => {
    if (!room && !myPlayer) {
      const timeout = setTimeout(() => {
        router.push('/');
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [room, myPlayer, router]);

  const isHost = myPlayer?.id === room?.hostPlayerId;
  const canStart = isHost && (room?.players.length ?? 0) >= 2;

  const handleStart = () => {
    if (room) {
      clearError();
      startGame(room.id);
    }
  };

  const handleLeave = () => {
    leaveRoom();
    router.push('/');
  };

  // ---- Phase-based routing ----

  // GAME_STARTING: countdown + player names
  if (gameState === 'game_starting') {
    return <GameStarting />;
  }

  // QUESTION phases: intro, active, reveal
  if (
    gameState === 'question_intro' ||
    gameState === 'question_active' ||
    gameState === 'question_reveal'
  ) {
    return <QuestionCard />;
  }

  // SCORES_UPDATE: scoreboard between questions
  if (gameState === 'scores_update') {
    return <Scoreboard />;
  }

  // ROUND_TRANSITION: dramatic round announcement
  if (gameState === 'round_transition' || gameState === 'round_intro') {
    return <RoundTransition />;
  }

  // GAME_OVER / POST_GAME: final scores + play again
  if (gameState === 'game_over' || gameState === 'post_game') {
    return <GameOver />;
  }

  // Loading state
  if (!room) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <p className="text-text-secondary text-[10px] animate-pulse-glow">
          CONNECTING...
        </p>
      </main>
    );
  }

  // LOBBY view (default)
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8">
      {/* Room Code Display */}
      <div className="text-center mb-8 mt-4">
        <p className="text-text-secondary text-[10px] mb-2">ROOM CODE</p>
        <div className="text-4xl sm:text-5xl text-glow-cyan tracking-[0.3em] mb-2">
          {room.id}
        </div>
        <p className="text-text-muted text-[8px]">
          Share this code with friends to join
        </p>
      </div>

      {/* Player List */}
      <div className="w-full max-w-sm mb-8">
        <p className="text-text-secondary text-[10px] text-center mb-4">
          PLAYERS ({room.players.length}/10)
        </p>
        <div className="flex flex-col gap-2">
          {room.players.map((player, index) => (
            <div
              key={player.id}
              className="flex items-center gap-3 p-3 border-2 border-border-default bg-bg-card"
            >
              <span className="text-neon-yellow text-[10px] w-6">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="text-text-primary text-xs flex-1">
                {player.name}
              </span>
              {player.id === room.hostPlayerId && (
                <span className="text-neon-magenta text-[8px]">HOST</span>
              )}
              {player.id === myPlayer?.id && (
                <span className="text-neon-green text-[8px]">YOU</span>
              )}
            </div>
          ))}
        </div>

        {room.players.length < 2 && (
          <p className="text-warning text-[8px] text-center mt-4 animate-pulse-glow">
            Waiting for more players to join...
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full max-w-sm">
        {isHost && (
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="pixel-btn pixel-btn-green w-full text-sm disabled:opacity-30"
          >
            {canStart ? 'Start Game' : 'Need 2+ Players'}
          </button>
        )}

        {!isHost && (
          <p className="text-text-muted text-[8px] text-center animate-pulse-glow">
            Waiting for host to start the game...
          </p>
        )}

        <button
          onClick={handleLeave}
          className="text-text-muted text-[10px] text-center mt-4 cursor-pointer hover:text-error"
        >
          LEAVE ROOM
        </button>
      </div>

      {error && (
        <div className="mt-6 p-3 border-2 border-error text-error text-[10px] text-center max-w-sm">
          {error}
        </div>
      )}
    </main>
  );
}
