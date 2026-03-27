'use client';

import { useGameStore } from '@/stores/gameStore';

export default function HostDialogue() {
  const hostDialogue = useGameStore((s) => s.hostDialogue);

  if (!hostDialogue) return null;

  return (
    <div className="w-full px-4 py-3 bg-bg-primary/90 border-y border-border-default backdrop-blur-sm">
      <p className="text-text-secondary text-[10px] sm:text-xs leading-relaxed text-center max-w-lg mx-auto">
        {hostDialogue}
      </p>
    </div>
  );
}
