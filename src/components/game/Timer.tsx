'use client';

import { useState, useEffect, useRef } from 'react';

interface TimerProps {
  endsAt: number;
  totalDuration?: number;
}

export default function Timer({ endsAt, totalDuration }: TimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [fraction, setFraction] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalMs = useRef(0);

  useEffect(() => {
    const now = Date.now();
    totalMs.current = totalDuration
      ? totalDuration * 1000
      : Math.max(endsAt - now, 1);

    // Update every 100ms for smooth bar movement
    const tick = () => {
      const remaining = Math.max(endsAt - Date.now(), 0);
      setSecondsLeft(Math.ceil(remaining / 1000));
      setFraction(remaining / totalMs.current);
    };

    tick(); // Initial
    intervalRef.current = setInterval(tick, 100);

    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [endsAt, totalDuration]);

  // Color transitions
  let barColor = 'bg-accent-cyan';
  let textColor = 'text-accent-cyan';
  if (secondsLeft <= 5) {
    barColor = 'bg-error';
    textColor = 'text-error animate-pulse';
  } else if (secondsLeft <= 10) {
    barColor = 'bg-accent-yellow';
    textColor = 'text-accent-yellow';
  }

  const widthPercent = Math.max(fraction * 100, 0);

  return (
    <div className="w-full">
      {/* Timer bar */}
      <div className="w-full h-2 bg-bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full`}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
      {/* Seconds */}
      <div className="text-center mt-1.5">
        <span className={`text-xs font-bold ${textColor}`}>
          {secondsLeft}s
        </span>
      </div>
    </div>
  );
}
