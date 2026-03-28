'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import HostDialogue from './HostDialogue';

export default function RoundTransition() {
  const currentRound = useGameStore((s) => s.currentRound);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 min-h-screen">
      <div
        className={`text-center transition-all duration-700 ${
          visible
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-75'
        }`}
      >
        <h1 className="text-5xl sm:text-7xl font-extrabold text-accent-cyan mb-6 tracking-tight">
          ROUND {currentRound}
        </h1>

        {currentRound >= 2 && (
          <div className="mb-8">
            <p className="text-accent-yellow text-lg sm:text-xl font-bold animate-pulse-glow">
              Values are DOUBLED!
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 w-full max-w-md">
        <HostDialogue />
      </div>
    </main>
  );
}
