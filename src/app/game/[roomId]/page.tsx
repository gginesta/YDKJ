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
import JackAttackCard from '@/components/game/JackAttackCard';

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

  const connected = useGameStore((s) => s.connected);

  useEffect(() => {
    // Only redirect if we have no room state AND we're connected (not mid-reconnect)
    if (!room && !myPlayer && connected) {
      const timeout = setTimeout(() => {
        router.push('/');
      }, 3000); // Give reconnection time to complete
      return () => clearTimeout(timeout);
    }
  }, [room, myPlayer, connected, router]);

  const isHost = myPlayer?.id === room?.hostPlayerId;
  const canStart = isHost && (room?.players.length ?? 0) >= 2;

  const handleStart = () => {
    if (room) {
      clearError();
      // Init audio on user gesture (required by browsers)
      import('@/lib/audio/sound-system').then((m) => m.initAudio());
      startGame(room.id);
    }
  };

  const handleLeave = () => {
    leaveRoom();
    router.push('/');
  };

  // ---- Phase-based routing ----

  if (gameState === 'game_starting') {
    return <GameStarting />;
  }

  if (
    gameState === 'question_intro' ||
    gameState === 'question_active' ||
    gameState === 'question_reveal'
  ) {
    return <QuestionCard />;
  }

  if (gameState === 'scores_update') {
    return <Scoreboard />;
  }

  if (
    gameState === 'jack_attack_intro' ||
    gameState === 'jack_attack_active' ||
    gameState === 'jack_attack_results'
  ) {
    return <JackAttackCard />;
  }

  if (gameState === 'round_transition' || gameState === 'round_intro') {
    return <RoundTransition />;
  }

  if (gameState === 'game_over' || gameState === 'post_game') {
    return <GameOver />;
  }

  // Loading state
  if (!room) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <p className="text-text-secondary text-sm animate-pulse-glow">
          Connecting...
        </p>
      </main>
    );
  }

  // LOBBY view
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8">
      {/* Room Code */}
      <div className="text-center mb-10 mt-4">
        <p className="text-text-secondary text-xs font-medium uppercase tracking-wider mb-3">
          Room Code
        </p>
        <div className="text-5xl sm:text-6xl font-extrabold tracking-[0.25em] text-accent-cyan mb-3">
          {room.id}
        </div>
        <p className="text-text-muted text-sm">
          Share this code with friends to join
        </p>
      </div>

      {/* Player List */}
      <div className="w-full max-w-sm mb-10">
        <p className="text-text-secondary text-xs font-medium uppercase tracking-wider text-center mb-4">
          Players ({room.players.length}/10)
        </p>
        <div className="flex flex-col gap-2">
          {room.players.map((player, index) => (
            <div
              key={player.id}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-bg-card border border-border-default"
            >
              <span className="text-accent-yellow text-sm font-bold w-6">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="text-text-primary text-sm font-medium flex-1">
                {player.name}
              </span>
              {player.id === room.hostPlayerId && (
                <span className="text-accent-purple text-xs font-bold uppercase">Host</span>
              )}
              {player.id === myPlayer?.id && (
                <span className="text-accent-cyan text-xs font-bold uppercase">You</span>
              )}
            </div>
          ))}
        </div>

        {room.players.length < 2 && (
          <p className="text-warning text-xs text-center mt-4 animate-pulse-glow">
            Waiting for more players to join...
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {isHost && (
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="btn-primary w-full"
          >
            {canStart ? 'Start Game' : 'Need 2+ Players'}
          </button>
        )}

        {!isHost && (
          <p className="text-text-muted text-sm text-center animate-pulse-glow">
            Waiting for host to start the game...
          </p>
        )}

        <button
          onClick={handleLeave}
          className="text-text-muted text-sm text-center mt-4 cursor-pointer hover:text-error transition-colors"
        >
          Leave Room
        </button>
      </div>

      {error && (
        <div className="mt-6 px-4 py-3 rounded-lg bg-error/10 border border-error/30 text-error text-sm text-center max-w-xs">
          {error}
        </div>
      )}
    </main>
  );
}
