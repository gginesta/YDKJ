'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import HostDialogue from './HostDialogue';

export default function RoundTransition() {
  const currentRound = useGameStore((s) => s.currentRound);
  const [visible, setVisible] = useState(false);

  // Animate in on mount
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
            : 'opacity-0 scale-50'
        }`}
      >
        {/* Round number */}
        <h1 className="text-4xl sm:text-6xl text-glow-cyan mb-6">
          ROUND {currentRound}
        </h1>

        {/* Double values notice for round 2+ */}
        {currentRound >= 2 && (
          <div className="mb-8">
            <p className="text-neon-yellow text-sm sm:text-base text-glow-yellow animate-pulse-glow">
              Values are DOUBLED!
            </p>
          </div>
        )}
      </div>

      {/* Host dialogue */}
      <div className="mt-8 w-full max-w-md">
        <HostDialogue />
      </div>
    </main>
  );
}
