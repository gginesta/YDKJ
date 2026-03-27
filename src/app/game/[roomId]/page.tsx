'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/stores/gameStore';

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

  // Game started - show placeholder screen
  if (gameState === 'game_starting') {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <h1 className="text-xl sm:text-2xl text-glow-yellow mb-8 text-center animate-pulse-glow">
          GAME STARTING
        </h1>
        <p className="text-text-secondary text-[10px] text-center leading-relaxed max-w-sm mb-8">
          Welcome to You Don&apos;t Know Jack! Get ready for some trivia with
          attitude...
        </p>
        <div className="flex flex-col gap-2 text-center">
          {room?.players.map((p) => (
            <span key={p.id} className="text-neon-cyan text-xs">
              {p.name}
            </span>
          ))}
        </div>
      </main>
    );
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

  // Lobby view
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
