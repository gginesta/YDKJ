'use client';

import { useState, useEffect, useRef } from 'react';

interface TimerProps {
  endsAt: number; // Unix timestamp in ms
  totalDuration?: number; // Total seconds for the timer (for bar width calc)
}

export default function Timer({ endsAt, totalDuration }: TimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [fraction, setFraction] = useState(1);
  const rafRef = useRef<number | null>(null);
  const totalMs = useRef(0);

  useEffect(() => {
    const now = Date.now();
    totalMs.current = totalDuration
      ? totalDuration * 1000
      : Math.max(endsAt - now, 1);

    const tick = () => {
      const remaining = Math.max(endsAt - Date.now(), 0);
      setSecondsLeft(Math.ceil(remaining / 1000));
      setFraction(remaining / totalMs.current);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    tick();
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [endsAt, totalDuration]);

  // Color transitions: cyan -> yellow (at 10s) -> red (at 5s)
  let barColor = 'bg-neon-cyan';
  let glowColor = 'shadow-[0_0_10px_var(--color-neon-cyan)]';
  if (secondsLeft <= 5) {
    barColor = 'bg-error';
    glowColor = 'shadow-[0_0_10px_var(--color-error)]';
  } else if (secondsLeft <= 10) {
    barColor = 'bg-neon-yellow';
    glowColor = 'shadow-[0_0_10px_var(--color-neon-yellow)]';
  }

  return (
    <div className="w-full">
      {/* Timer bar container */}
      <div className="w-full h-3 bg-bg-secondary border border-border-default overflow-hidden">
        <div
          className={`h-full ${barColor} ${glowColor} transition-colors duration-300`}
          style={{
            width: `${Math.max(fraction * 100, 0)}%`,
            transition: 'width 0.1s linear',
          }}
        />
      </div>
      {/* Seconds text */}
      <div className="text-center mt-1">
        <span
          className={`text-[10px] ${
            secondsLeft <= 5
              ? 'text-error animate-pulse'
              : secondsLeft <= 10
                ? 'text-neon-yellow'
                : 'text-neon-cyan'
          }`}
        >
          {secondsLeft}s
        </span>
      </div>
    </div>
  );
}
