"use client";

import { HpBar } from "@/components/ui/HpBar";

interface HealthBarsSectionProps {
  playerHp: number;
  aiHp: number;
  damageFlash?: { player: number; ai: number } | null;
  clutchTurn?: boolean;
}

export function HealthBarsSection({
  playerHp,
  aiHp,
  damageFlash,
  clutchTurn,
}: HealthBarsSectionProps) {
  return (
    <section className="flex gap-4 mb-10 relative">
      {clutchTurn && (
        <p className="absolute -top-5 left-0 right-0 text-center text-[8px] text-duel-gold tracking-[0.3em] uppercase animate-pulse">
          Clutch turn — +10% damage
        </p>
      )}
      <div className="flex-1 relative">
        <HpBar hp={playerHp} label="YOU" />
        {damageFlash && damageFlash.player > 0 && (
          <span className="absolute top-1/2 right-2 -translate-y-1/2 text-destructive text-sm font-bold animate-fade-in">
            −{damageFlash.player}
          </span>
        )}
      </div>
      <div className="w-[1px] bg-white/5 self-stretch" />
      <div className="flex-1 relative">
        <HpBar hp={aiHp} label="CIPHER" />
        {damageFlash && damageFlash.ai > 0 && (
          <span className="absolute top-1/2 right-2 -translate-y-1/2 text-celo-green text-sm font-bold animate-fade-in">
            −{damageFlash.ai}
          </span>
        )}
      </div>
    </section>
  );
}
