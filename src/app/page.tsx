'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/stores/gameStore';

export default function HomePage() {
  const router = useRouter();
  const { createRoom } = useSocket();
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const error = useGameStore((s) => s.error);
  const room = useGameStore((s) => s.room);
  const clearError = useGameStore((s) => s.clearError);

  // When room is created, navigate to the game lobby
  if (room) {
    router.push(`/game/${room.id}`);
  }

  const handleCreate = () => {
    if (!name.trim()) return;
    clearError();
    setIsCreating(true);
    createRoom(name.trim());
    setTimeout(() => setIsCreating(false), 3000);
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      {/* Title */}
      <div className="text-center mb-10">
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-none mb-1">
          <span className="text-text-primary">YOU DON&apos;T</span>
        </h1>
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-none mb-1">
          <span className="text-text-primary">KNOW</span>
        </h1>
        <h1 className="text-6xl sm:text-8xl font-extrabold tracking-tight leading-none">
          <span className="text-accent-yellow">JACK</span>
        </h1>
      </div>

      <p className="text-text-secondary text-sm sm:text-base text-center mb-10 max-w-sm">
        Where high culture and pop culture collide. Up to 10 players.
      </p>

      {!showNameInput ? (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => setShowNameInput(true)}
            className="btn-primary w-full"
          >
            Create Game
          </button>
          <button
            onClick={() => router.push('/join')}
            className="btn-secondary w-full"
          >
            Join Game
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 w-full max-w-xs animate-fade-in-up">
          <label className="text-text-secondary text-xs font-medium text-center uppercase tracking-wider">
            Your Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Enter name"
            className="game-input"
            autoFocus
            maxLength={16}
          />
          <button
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            className="btn-primary w-full"
          >
            {isCreating ? 'Creating...' : "Let's Go!"}
          </button>
          <button
            onClick={() => {
              setShowNameInput(false);
              clearError();
            }}
            className="text-text-muted text-sm text-center mt-1 cursor-pointer hover:text-text-secondary transition-colors"
          >
            Back
          </button>
        </div>
      )}

      {error && (
        <div className="mt-6 px-4 py-3 rounded-lg bg-error/10 border border-error/30 text-error text-sm text-center max-w-xs">
          {error}
        </div>
      )}
    </main>
  );
}
