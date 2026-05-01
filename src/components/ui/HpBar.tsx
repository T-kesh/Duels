"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface HpBarProps {
  hp: number;
  maxHp?: number;
  label: string;
  className?: string;
}

export function HpBar({ hp, maxHp = 100, label, className }: HpBarProps) {
  const percentage = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  
  const getHpColor = (val: number) => {
    if (val > 60) return "bg-celo-green shadow-[0_0_10px_rgba(53,212,106,0.4)]";
    if (val > 30) return "bg-duel-gold shadow-[0_0_10px_rgba(252,196,25,0.4)]";
    return "bg-destructive shadow-[0_0_10px_rgba(255,77,79,0.4)]";
  };

  const getLabelColor = (val: number) => {
    if (val > 60) return "text-celo-green";
    if (val > 30) return "text-duel-gold";
    return "text-destructive";
  };

  return (
    <div className={cn("flex-1", className)}>
      <div className="flex justify-between items-end mb-1.5">
        <span className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">{label}</span>
        <span className={cn("text-sm font-mono font-bold", getLabelColor(percentage))}>
          {hp}
        </span>
      </div>
      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden border border-white/5">
        <div
          className={cn("h-full transition-all duration-700 ease-out rounded-full", getHpColor(percentage))}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
