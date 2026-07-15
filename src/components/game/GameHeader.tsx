"use client";

import { Zap } from "lucide-react";

interface GameHeaderProps {
  /** Lives from the timed recharge bucket (cap `maxBaseLives`). */
  rechargeableLives: number;
  /** Extra plays from verified cUSD top-ups (consumed before recharge bucket). */
  bonusLives: number;
  maxBaseLives: number;
  currentTurnDisplay: number;
}

export function GameHeader({
  rechargeableLives,
  bonusLives,
  maxBaseLives,
  currentTurnDisplay,
}: GameHeaderProps) {
  const totalPlays = rechargeableLives + bonusLives;

  return (
    <header className="flex justify-between items-center mb-8">
      <div className="flex flex-col">
        <span className="text-xl font-bold tracking-[0.3em] text-duel-gold">DUEL</span>
        <span className="text-[9px] text-muted-foreground tracking-widest uppercase mt-1">
          Celo Mainnet
        </span>
      </div>
      <div className="flex gap-2 items-center">
        <div className="px-3 py-1.5 glass border-white/10 rounded-lg flex flex-col gap-0.5 min-w-[4.75rem]">
          <div className="flex items-center gap-1.5 justify-end">
            <Zap className="w-3 h-3 text-duel-gold/80" fill="currentColor" />
            <span className="text-[10px] font-mono font-bold text-white tabular-nums">
              {totalPlays}
            </span>
          </div>
          <span className="text-[8px] text-muted-foreground font-mono text-right opacity-80 leading-none">
            base {Math.min(rechargeableLives, maxBaseLives)}/{maxBaseLives}
            {bonusLives > 0 ? ` · +${bonusLives}` : ""}
          </span>
        </div>
        <div className="px-3 py-1.5 glass border-duel-gold/20 rounded-lg">
          <span className="text-[10px] font-mono font-bold text-duel-gold tracking-widest">
            TURN {currentTurnDisplay}/3
          </span>
        </div>
      </div>
    </header>
  );
}
