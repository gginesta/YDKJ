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

  const ranked = [...finalScores].sort((a, b) => b.money - a.money);

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
        <p className="text-text-muted text-xs uppercase tracking-wider mb-3">Game Over</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-accent-yellow tracking-tight">
          FINAL SCORES
        </h1>
      </div>

      {/* Host outro */}
      {gameOverHostScript && (
        <div className="w-full max-w-md px-5 py-4 rounded-lg bg-bg-card border border-border-default mb-8">
          <p className="text-text-secondary text-sm leading-relaxed text-center italic">
            &ldquo;{gameOverHostScript}&rdquo;
          </p>
        </div>
      )}

      {/* Rankings */}
      <div className="w-full max-w-sm flex flex-col gap-3 mb-10">
        {ranked.map((entry, index) => {
          const isMe = entry.playerId === myPlayer?.id;
          const isWinner = index === 0;
          const rank = index + 1;

          return (
            <div
              key={entry.playerId}
              className={`relative flex items-center gap-3 px-4 py-4 rounded-lg border transition-all animate-fade-in-up ${
                isWinner
                  ? 'border-accent-yellow/50 bg-accent-yellow/5'
                  : isMe
                    ? 'border-accent-cyan/50 bg-accent-cyan/5'
                    : 'border-border-default bg-bg-card'
              }`}
              style={{ animationDelay: `${index * 150}ms` }}
            >
              {/* Rank */}
              <div className="text-center w-10 shrink-0">
                <span className={`text-lg font-extrabold ${
                  isWinner ? 'text-accent-yellow' : 'text-text-muted'
                }`}>
                  #{rank}
                </span>
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm sm:text-base font-bold truncate ${
                      isWinner ? 'text-accent-yellow' : 'text-text-primary'
                    }`}
                  >
                    {entry.name}
                  </span>
                  {isMe && (
                    <span className="text-accent-cyan text-xs font-bold">YOU</span>
                  )}
                </div>
                {isWinner && (
                  <p className="text-accent-yellow text-xs font-bold mt-0.5">
                    WINNER
                  </p>
                )}
              </div>

              {/* Money */}
              <span
                className={`text-base sm:text-lg font-extrabold shrink-0 ${
                  isWinner
                    ? 'text-accent-yellow'
                    : entry.money >= 0
                      ? 'text-success'
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
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={handlePlayAgain}
          className="btn-primary w-full"
        >
          Play Again
        </button>
        <button
          onClick={handleLeave}
          className="btn-secondary w-full"
        >
          Leave Game
        </button>
      </div>
    </main>
  );
}
