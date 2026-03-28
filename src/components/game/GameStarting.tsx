'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';

export default function GameStarting() {
  const room = useGameStore((s) => s.room);
  const hostDialogue = useGameStore((s) => s.hostDialogue);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 min-h-screen">
      {/* Countdown */}
      <div className="mb-10 text-center">
        {countdown > 0 ? (
          <>
            <p className="text-text-secondary text-sm font-medium uppercase tracking-wider mb-6 animate-pulse-glow">
              Game Starting In
            </p>
            <div className="text-7xl sm:text-9xl font-extrabold text-accent-yellow animate-scale-in">
              {countdown}
            </div>
          </>
        ) : (
          <h1 className="text-4xl sm:text-5xl font-extrabold text-accent-cyan animate-pulse-glow tracking-tight">
            GET READY!
          </h1>
        )}
      </div>

      {/* Host dialogue */}
      {hostDialogue && (
        <div className="w-full max-w-md px-5 py-4 rounded-lg bg-bg-card border border-border-default mb-8">
          <p className="text-text-secondary text-sm leading-relaxed text-center italic">
            &ldquo;{hostDialogue}&rdquo;
          </p>
        </div>
      )}

      {/* Player names */}
      <div className="flex flex-col gap-2 text-center">
        <p className="text-text-muted text-xs uppercase tracking-wider mb-2">Players</p>
        <div className="flex flex-wrap justify-center gap-2">
          {room?.players.map((p) => (
            <span
              key={p.id}
              className="text-accent-cyan text-sm font-bold px-3 py-1 rounded-full bg-accent-cyan/10"
            >
              {p.name}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
