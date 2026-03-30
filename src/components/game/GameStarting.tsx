'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';

const QUIRKY_MESSAGES = [
  "Host is warming up...",
  "Shuffling the deck of useless knowledge...",
  "Calibrating sarcasm levels...",
  "Preparing personalized roasts...",
  "Loading obscure facts nobody asked for...",
  "Consulting the encyclopedia of things you should know but don't...",
  "Teaching the host your names so it can mock you personally...",
  "Generating questions you'll pretend to know the answers to...",
  "Warming up the buzzer...",
  "Polishing the host's ego...",
  "Loading bad puns and worse jokes...",
  "Reminding the host to be nice (it won't listen)...",
];

export default function GameStarting() {
  const room = useGameStore((s) => s.room);
  const hostDialogue = useGameStore((s) => s.hostDialogue);
  const loadingProgress = useGameStore((s) => s.loadingProgress);
  const [messageIndex, setMessageIndex] = useState(0);

  // Rotate quirky messages every 2.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setMessageIndex((i) => (i + 1) % QUIRKY_MESSAGES.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const isLoading = loadingProgress && loadingProgress.total > 0;
  const progressPercent = isLoading
    ? Math.round((loadingProgress.completed / loadingProgress.total) * 100)
    : 0;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 min-h-screen">
      {/* Title */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-accent-cyan animate-pulse-glow tracking-tight">
          GET READY!
        </h1>
      </div>

      {/* Host dialogue */}
      {hostDialogue && (
        <div className="w-full max-w-md px-5 py-4 rounded-lg bg-bg-card border border-border-default mb-8">
          <p className="text-text-secondary text-sm leading-relaxed text-center italic">
            &ldquo;{hostDialogue}&rdquo;
          </p>
        </div>
      )}

      {/* Player names */}
      <div className="flex flex-col gap-2 text-center mb-8">
        <p className="text-text-muted text-xs uppercase tracking-wider mb-2">Players</p>
        <div className="flex flex-wrap justify-center gap-2">
          {room?.players.map((p) => (
            <span
              key={p.id}
              className="text-accent-cyan text-sm font-bold px-3 py-1 rounded-full bg-accent-cyan/10"
            >
              {p.name}
            </span>
          ))}
        </div>
      </div>

      {/* Loading progress */}
      {isLoading && (
        <div className="w-full max-w-sm">
          {/* Progress bar */}
          <div className="w-full h-2 bg-bg-card rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-accent-cyan rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Quirky message */}
          <p className="text-text-muted text-xs text-center animate-pulse-glow">
            {QUIRKY_MESSAGES[messageIndex]}
          </p>
        </div>
      )}

      {/* Simple loading state when no progress data (voice disabled) */}
      {!isLoading && !hostDialogue && (
        <p className="text-text-muted text-sm animate-pulse-glow">
          Starting game...
        </p>
      )}
    </main>
  );
}
