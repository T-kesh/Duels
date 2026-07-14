"use client";

import { HpBar } from "@/components/ui/HpBar";

interface HealthBarsSectionProps {
  playerHp: number;
  aiHp: number;
  visualHp?: { player: number; ai: number } | null;
  damageFlash?: { player: number; ai: number } | null;
  healFlash?: { player: number; ai: number } | null;
  clutchTurn?: boolean;
}

export function HealthBarsSection({
  playerHp,
  aiHp,
  visualHp,
  damageFlash,
  healFlash,
  clutchTurn,
}: HealthBarsSectionProps) {
  // Fallback to true state HP if visual HP transition state is currently idle/null
  const activePlayerHp = visualHp ? visualHp.player : playerHp;
  const activeAiHp = visualHp ? visualHp.ai : aiHp;

  return (
    <section className="flex gap-4 mb-10 relative">
      {clutchTurn && (
        <p className="absolute -top-5 left-0 right-0 text-center text-[8px] text-duel-gold tracking-[0.3em] uppercase animate-pulse">
          Clutch turn — +10% damage
        </p>
      )}
      <div className="flex-1 relative">
        <HpBar hp={activePlayerHp} label="YOU" />
        {damageFlash && damageFlash.player > 0 && (
          <span className="absolute top-1/2 right-2 -translate-y-1/2 text-destructive text-sm font-bold animate-float-up drop-shadow-[0_0_6px_rgba(255,77,79,0.6)]">
            −{damageFlash.player}
          </span>
        )}
        {healFlash && healFlash.player > 0 && (
          <span className="absolute top-1/2 right-2 -translate-y-1/2 text-celo-green text-sm font-bold animate-float-up drop-shadow-[0_0_6px_rgba(53,212,106,0.6)]">
            +{healFlash.player}
          </span>
        )}
      </div>
      <div className="w-[1px] bg-white/5 self-stretch" />
      <div className="flex-1 relative">
        <HpBar hp={activeAiHp} label="CIPHER" />
        {damageFlash && damageFlash.ai > 0 && (
          <span className="absolute top-1/2 right-2 -translate-y-1/2 text-celo-green text-sm font-bold animate-float-up drop-shadow-[0_0_6px_rgba(53,212,106,0.6)]">
            −{damageFlash.ai}
          </span>
        )}
        {healFlash && healFlash.ai > 0 && (
          <span className="absolute top-1/2 right-2 -translate-y-1/2 text-celo-green text-sm font-bold animate-float-up drop-shadow-[0_0_6px_rgba(53,212,106,0.6)]">
            +{healFlash.ai}
          </span>
        )}
      </div>
    </section>
  );
}
