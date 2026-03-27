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
      // Ease out cubic
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

  // Format as $X,XXX (handle negatives)
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

  // Sort scores by money descending
  const ranked = [...scores].sort((a, b) => b.money - a.money);

  // Build streak info from room players
  const streakMap = new Map<string, number>();
  room?.players.forEach((p) => {
    streakMap.set(p.id, p.streak);
  });

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 min-h-screen">
      {/* Round info */}
      <div className="text-center mb-6">
        <p className="text-text-muted text-[8px] mb-2">SCOREBOARD</p>
        <p className="text-neon-yellow text-[10px]">
          Round {currentRound} of 2
        </p>
      </div>

      {/* Scores list */}
      <div className="w-full max-w-sm flex flex-col gap-2">
        {ranked.map((entry, index) => {
          const isMe = entry.playerId === myPlayer?.id;
          const streak = streakMap.get(entry.playerId) ?? 0;
          const rank = index + 1;

          // Rank colors
          let rankColor = 'text-text-muted';
          if (rank === 1) rankColor = 'text-neon-yellow';
          else if (rank === 2) rankColor = 'text-text-secondary';
          else if (rank === 3) rankColor = 'text-neon-magenta';

          return (
            <div
              key={entry.playerId}
              className={`flex items-center gap-3 p-3 border-2 ${
                isMe
                  ? 'border-neon-cyan bg-neon-cyan/10 shadow-[0_0_8px_var(--color-neon-cyan)]'
                  : 'border-border-default bg-bg-card'
              }`}
            >
              {/* Rank */}
              <span className={`text-sm sm:text-base font-bold w-8 text-center ${rankColor}`}>
                {rank === 1 ? '\u2655' : `#${rank}`}
              </span>

              {/* Name + streak */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-text-primary text-xs truncate">
                    {entry.name}
                  </span>
                  {isMe && (
                    <span className="text-neon-cyan text-[8px] shrink-0">YOU</span>
                  )}
                </div>
                {streak >= 3 && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[8px]">
                      {streak >= 5 ? '\uD83D\uDD25\uD83D\uDD25' : '\uD83D\uDD25'}
                    </span>
                    <span className="text-neon-yellow text-[8px]">
                      {streak} streak!
                    </span>
                  </div>
                )}
              </div>

              {/* Money */}
              <span
                className={`text-xs sm:text-sm font-bold shrink-0 ${
                  entry.money >= 0 ? 'text-neon-green' : 'text-error'
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
