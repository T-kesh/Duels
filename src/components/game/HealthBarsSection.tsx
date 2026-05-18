"use client";

import { HpBar } from "@/components/ui/HpBar";

interface HealthBarsSectionProps {
  playerHp: number;
  aiHp: number;
}

export function HealthBarsSection({ playerHp, aiHp }: HealthBarsSectionProps) {
  return (
    <section className="flex gap-4 mb-10">
      <HpBar hp={playerHp} label="YOU" />
      <div className="w-[1px] bg-white/5 self-stretch" />
      <HpBar hp={aiHp} label="CIPHER" />
    </section>
  );
}
