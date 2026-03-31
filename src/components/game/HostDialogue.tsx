'use client';

import { useGameStore } from '@/stores/gameStore';

export default function HostDialogue() {
  const hostDialogue = useGameStore((s) => s.hostDialogue);

  if (!hostDialogue) return null;

  return (
    <div className="w-full px-4 py-3 mb-4 rounded-lg bg-bg-card border border-border-default">
      <p className="text-text-secondary text-base leading-relaxed text-center max-w-lg mx-auto italic">
        &ldquo;{hostDialogue}&rdquo;
      </p>
    </div>
  );
}
