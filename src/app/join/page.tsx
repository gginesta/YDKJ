'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/stores/gameStore';

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { joinRoom } = useSocket();
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [name, setName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const error = useGameStore((s) => s.error);
  const room = useGameStore((s) => s.room);
  const clearError = useGameStore((s) => s.clearError);

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
    const cleaned = val.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4);
    setCode(cleaned);
  };

  return (
    <>
      <div className="flex flex-col gap-6 w-full max-w-xs">
        <div className="flex flex-col gap-2">
          <label className="text-text-secondary text-xs font-medium text-center uppercase tracking-wider">
            Room Code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="ABCD"
            className="game-input text-2xl tracking-[0.4em] font-bold"
            autoFocus
            maxLength={4}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-text-secondary text-xs font-medium text-center uppercase tracking-wider">
            Your Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="Enter name"
            className="game-input"
            maxLength={16}
            autoComplete="name"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
          />
        </div>

        <button
          onClick={handleJoin}
          disabled={code.length !== 4 || !name.trim() || isJoining}
          className="btn-primary w-full"
        >
          {isJoining ? 'Joining...' : 'Join Room'}
        </button>

        <button
          onClick={() => {
            clearError();
            router.push('/');
          }}
          className="text-text-muted text-sm text-center mt-1 cursor-pointer hover:text-text-secondary transition-colors"
        >
          Back
        </button>
      </div>

      {error && (
        <div className="mt-6 px-4 py-3 rounded-lg bg-error/10 border border-error/30 text-error text-sm text-center max-w-xs">
          {error}
        </div>
      )}
    </>
  );
}

export default function JoinPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-8 text-center text-text-primary">
        JOIN GAME
      </h1>
      <Suspense fallback={<p className="text-text-muted text-sm">Loading...</p>}>
        <JoinForm />
      </Suspense>
    </main>
  );
}
