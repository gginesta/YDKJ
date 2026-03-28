'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';

function AnimatedMoney({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev === target) return;

    const startTime = Date.now();
    const diff = target - prev;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(prev + diff * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevRef.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  const formatted =
    (display < 0 ? '-' : '') +
    '$' +
    Math.abs(display).toLocaleString('en-US');

  return <>{formatted}</>;
}

export default function Scoreboard() {
  const scores = useGameStore((s) => s.scores);
  const myPlayer = useGameStore((s) => s.myPlayer);
  const currentRound = useGameStore((s) => s.currentRound);
  const room = useGameStore((s) => s.room);

  const ranked = [...scores].sort((a, b) => b.money - a.money);

  const streakMap = new Map<string, number>();
  room?.players.forEach((p) => {
    streakMap.set(p.id, p.streak);
  });

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 min-h-screen">
      <div className="text-center mb-8">
        <p className="text-text-muted text-xs uppercase tracking-wider mb-2">Scoreboard</p>
        <p className="text-accent-yellow text-sm font-bold">
          Round {currentRound} of {Math.max(currentRound, 2)}
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-2">
        {ranked.map((entry, index) => {
          const isMe = entry.playerId === myPlayer?.id;
          const streak = streakMap.get(entry.playerId) ?? 0;
          const rank = index + 1;

          return (
            <div
              key={entry.playerId}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all animate-fade-in-up ${
                isMe
                  ? 'border-accent-cyan/50 bg-accent-cyan/5'
                  : 'border-border-default bg-bg-card'
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Rank */}
              <span className={`text-lg font-extrabold w-8 text-center ${
                rank === 1 ? 'text-accent-yellow' :
                rank === 2 ? 'text-text-secondary' :
                rank === 3 ? 'text-accent-orange' : 'text-text-muted'
              }`}>
                {rank === 1 ? '#1' : `#${rank}`}
              </span>

              {/* Name + streak */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-text-primary text-sm font-medium truncate">
                    {entry.name}
                  </span>
                  {isMe && (
                    <span className="text-accent-cyan text-xs font-bold">YOU</span>
                  )}
                </div>
                {streak >= 3 && (
                  <p className="text-accent-orange text-xs font-medium mt-0.5">
                    {streak} streak
                  </p>
                )}
              </div>

              {/* Money */}
              <span
                className={`text-sm sm:text-base font-extrabold shrink-0 ${
                  entry.money >= 0 ? 'text-success' : 'text-error'
                }`}
              >
                <AnimatedMoney target={entry.money} />
              </span>
            </div>
          );
        })}
      </div>
    </main>
  );
}
