'use client';

import { useRouter } from 'next/navigation';
import { useGameStore } from '@/stores/gameStore';
import { useSocket } from '@/hooks/useSocket';

function formatMoney(val: number) {
  return (val < 0 ? '-' : '') + '$' + Math.abs(val).toLocaleString('en-US');
}

export default function GameOver() {
  const router = useRouter();
  const finalScores = useGameStore((s) => s.finalScores);
  const gameOverHostScript = useGameStore((s) => s.gameOverHostScript);
  const myPlayer = useGameStore((s) => s.myPlayer);
  const { playAgain, leaveRoom } = useSocket();

  // Sort by money descending
  const ranked = [...finalScores].sort((a, b) => b.money - a.money);
  const winner = ranked[0];

  const handlePlayAgain = () => {
    playAgain();
  };

  const handleLeave = () => {
    leaveRoom();
    router.push('/');
  };

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 min-h-screen">
      {/* Header */}
      <div className="text-center mb-8 mt-4">
        <p className="text-text-muted text-[8px] mb-2">GAME OVER</p>
        <h1 className="text-2xl sm:text-4xl text-glow-yellow mb-2">
          FINAL SCORES
        </h1>
      </div>

      {/* Host outro */}
      {gameOverHostScript && (
        <div className="w-full max-w-md px-4 py-3 bg-bg-primary/90 border-y border-border-default mb-6">
          <p className="text-text-secondary text-[10px] sm:text-xs leading-relaxed text-center">
            {gameOverHostScript}
          </p>
        </div>
      )}

      {/* Rankings */}
      <div className="w-full max-w-sm flex flex-col gap-3 mb-8">
        {ranked.map((entry, index) => {
          const isMe = entry.playerId === myPlayer?.id;
          const isWinner = index === 0;
          const rank = index + 1;

          return (
            <div
              key={entry.playerId}
              className={`relative flex items-center gap-3 p-4 border-2 transition-all ${
                isWinner
                  ? 'border-neon-yellow bg-neon-yellow/10 shadow-[0_0_20px_var(--color-neon-yellow)]'
                  : isMe
                    ? 'border-neon-cyan bg-neon-cyan/10'
                    : 'border-border-default bg-bg-card'
              }`}
            >
              {/* Winner crown / rank */}
              <div className="text-center w-10 shrink-0">
                {isWinner ? (
                  <div>
                    <span className="text-2xl">{'\uD83D\uDC51'}</span>
                  </div>
                ) : (
                  <span className="text-text-muted text-sm">#{rank}</span>
                )}
              </div>

              {/* Name + winner label */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs sm:text-sm truncate ${
                      isWinner ? 'text-neon-yellow' : 'text-text-primary'
                    }`}
                  >
                    {entry.name}
                  </span>
                  {isMe && (
                    <span className="text-neon-cyan text-[8px] shrink-0">YOU</span>
                  )}
                </div>
                {isWinner && (
                  <p className="text-neon-yellow text-[8px] text-glow-yellow mt-1">
                    WINNER
                  </p>
                )}
              </div>

              {/* Money */}
              <span
                className={`text-sm sm:text-base font-bold shrink-0 ${
                  isWinner
                    ? 'text-neon-yellow text-glow-yellow'
                    : entry.money >= 0
                      ? 'text-neon-green'
                      : 'text-error'
                }`}
              >
                {formatMoney(entry.money)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <button
          onClick={handlePlayAgain}
          className="pixel-btn pixel-btn-cyan w-full text-sm"
        >
          Play Again
        </button>
        <button
          onClick={handleLeave}
          className="pixel-btn pixel-btn-magenta w-full text-sm"
        >
          Leave Game
        </button>
      </div>
    </main>
  );
}
