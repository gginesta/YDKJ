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
    // Navigation happens via the room state watch above
    setTimeout(() => setIsCreating(false), 3000);
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      {/* Title */}
      <div className="text-center mb-12">
        <h1 className="text-2xl sm:text-4xl text-glow-cyan mb-4 leading-relaxed">
          YOU DON&apos;T
        </h1>
        <h1 className="text-3xl sm:text-5xl text-glow-magenta mb-4 leading-relaxed">
          KNOW
        </h1>
        <h1 className="text-4xl sm:text-6xl text-glow-yellow leading-relaxed">
          JACK
        </h1>
      </div>

      <p className="text-text-secondary text-[10px] sm:text-xs text-center mb-12 max-w-sm leading-relaxed">
        Where high culture and pop culture collide. Up to 10 players.
      </p>

      {!showNameInput ? (
        <div className="flex flex-col gap-4 w-full max-w-sm">
          <button
            onClick={() => setShowNameInput(true)}
            className="pixel-btn pixel-btn-cyan w-full text-sm"
          >
            Create Game
          </button>
          <button
            onClick={() => router.push('/join')}
            className="pixel-btn pixel-btn-magenta w-full text-sm"
          >
            Join Game
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 w-full max-w-sm">
          <label className="text-text-secondary text-[10px] text-center">
            YOUR NAME
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="ENTER NAME"
            className="pixel-input"
            autoFocus
            maxLength={16}
          />
          <button
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            className="pixel-btn pixel-btn-green w-full text-sm disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : "Let's Go!"}
          </button>
          <button
            onClick={() => {
              setShowNameInput(false);
              clearError();
            }}
            className="text-text-muted text-[10px] text-center mt-2 cursor-pointer hover:text-text-secondary"
          >
            BACK
          </button>
        </div>
      )}

      {error && (
        <div className="mt-6 p-3 border-2 border-error text-error text-[10px] text-center max-w-sm">
          {error}
        </div>
      )}
    </main>
  );
}
