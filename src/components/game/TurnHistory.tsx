"use client";

import type { TurnResult } from "@/lib/gameEngine";

interface TurnHistoryProps {
  turns: TurnResult[];
  visible: boolean;
}

export function TurnHistory({ turns, visible }: TurnHistoryProps) {
  if (!visible || turns.length === 0) return null;

  return (
    <div className="absolute top-4 left-0 right-0 px-4 flex justify-center gap-2 opacity-40">
      {turns.map((t, i) => (
        <div
          key={i}
          className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded border border-white/10"
        >
          T{i + 1}: {t.playerCard.emoji} vs {t.aiCard.emoji}
        </div>
      ))}
    </div>
  );
}
