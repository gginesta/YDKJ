'use client';

import { useGameStore } from '@/stores/gameStore';

export default function HostDialogue() {
  const hostDialogue = useGameStore((s) => s.hostDialogue);

  if (!hostDialogue) return null;

  return (
    <div className="w-full px-5 py-4 bg-bg-card/80 border-y border-border-default backdrop-blur-sm">
      <p className="text-text-secondary text-sm leading-relaxed text-center max-w-lg mx-auto italic">
        &ldquo;{hostDialogue}&rdquo;
      </p>
    </div>
  );
}
