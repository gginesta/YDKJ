'use client';

import { useState, useEffect, useRef } from 'react';

interface TimerProps {
  endsAt: number;
  totalDuration?: number;
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

  // Color transitions
  let barColor = 'bg-accent-cyan';
  if (secondsLeft <= 5) {
    barColor = 'bg-error';
  } else if (secondsLeft <= 10) {
    barColor = 'bg-accent-yellow';
  }

  return (
    <div className="w-full">
      {/* Timer bar */}
      <div className="w-full h-2 bg-bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-colors duration-300`}
          style={{
            width: `${Math.max(fraction * 100, 0)}%`,
            transition: 'width 0.1s linear, background-color 0.3s',
          }}
        />
      </div>
      {/* Seconds */}
      <div className="text-center mt-1.5">
        <span
          className={`text-xs font-bold ${
            secondsLeft <= 5
              ? 'text-error animate-pulse'
              : secondsLeft <= 10
                ? 'text-accent-yellow'
                : 'text-accent-cyan'
          }`}
        >
          {secondsLeft}s
        </span>
      </div>
    </div>
  );
}
