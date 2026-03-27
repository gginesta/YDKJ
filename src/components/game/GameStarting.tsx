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
      <div className="mb-8 text-center">
        {countdown > 0 ? (
          <>
            <p className="text-text-secondary text-[10px] mb-4 animate-pulse-glow">
              GAME STARTING IN
            </p>
            <div className="text-6xl sm:text-8xl text-glow-yellow animate-pulse">
              {countdown}
            </div>
          </>
        ) : (
          <h1 className="text-2xl sm:text-4xl text-glow-cyan animate-pulse-glow">
            GET READY!
          </h1>
        )}
      </div>

      {/* Host dialogue */}
      {hostDialogue && (
        <p className="text-text-secondary text-[10px] sm:text-xs text-center leading-relaxed max-w-sm mb-8 px-4">
          {hostDialogue}
        </p>
      )}

      {/* Player names */}
      <div className="flex flex-col gap-2 text-center">
        <p className="text-text-muted text-[8px] mb-2">PLAYERS</p>
        {room?.players.map((p) => (
          <span
            key={p.id}
            className="text-neon-cyan text-xs"
          >
            {p.name}
          </span>
        ))}
      </div>
    </main>
  );
}
