'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/stores/gameStore';

export default function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { joinRoom } = useSocket();
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [name, setName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const error = useGameStore((s) => s.error);
  const room = useGameStore((s) => s.room);
  const clearError = useGameStore((s) => s.clearError);

  // When room is joined, navigate to the game lobby
  useEffect(() => {
    if (room) {
      router.push(`/game/${room.id}`);
    }
  }, [room, router]);

  const handleJoin = () => {
    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    if (!trimmedCode || trimmedCode.length !== 4 || !trimmedName) return;
    clearError();
    setIsJoining(true);
    joinRoom(trimmedCode, trimmedName);
    setTimeout(() => setIsJoining(false), 3000);
  };

  const handleCodeChange = (val: string) => {
    // Only allow letters, auto-uppercase, max 4
    const cleaned = val.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4);
    setCode(cleaned);
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <h1 className="text-xl sm:text-2xl text-glow-magenta mb-8 text-center">
        JOIN GAME
      </h1>

      <div className="flex flex-col gap-6 w-full max-w-sm">
        {/* Room Code */}
        <div className="flex flex-col gap-2">
          <label className="text-text-secondary text-[10px] text-center">
            ROOM CODE
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="ABCD"
            className="pixel-input text-2xl tracking-[0.5em]"
            autoFocus
            maxLength={4}
          />
        </div>

        {/* Player Name */}
        <div className="flex flex-col gap-2">
          <label className="text-text-secondary text-[10px] text-center">
            YOUR NAME
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="ENTER NAME"
            className="pixel-input"
            maxLength={16}
          />
        </div>

        <button
          onClick={handleJoin}
          disabled={code.length !== 4 || !name.trim() || isJoining}
          className="pixel-btn pixel-btn-cyan w-full text-sm disabled:opacity-50"
        >
          {isJoining ? 'Joining...' : 'Join Room'}
        </button>

        <button
          onClick={() => {
            clearError();
            router.push('/');
          }}
          className="text-text-muted text-[10px] text-center mt-2 cursor-pointer hover:text-text-secondary"
        >
          BACK
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
