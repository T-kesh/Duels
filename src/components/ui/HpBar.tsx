"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface HpBarProps {
  hp: number;
  maxHp?: number;
  label: string;
  className?: string;
}

export function HpBar({ hp, maxHp = 100, label, className }: HpBarProps) {
  const percentage = Math.max(0, Math.min(100, (hp / maxHp) * 100));

  // Ghost trail: when HP drops, a pale bar lingers at the previous value and
  // shrinks after a beat, tracing how much was just lost. On heals it snaps
  // to the new value so it never reads as phantom damage.
  const [ghost, setGhost] = useState(percentage);
  const prevPct = useRef(percentage);
  // Direction of the last change drives number color/pop styling.
  const [delta, setDelta] = useState<"damage" | "heal" | null>(null);

  useEffect(() => {
    const prev = prevPct.current;
    if (percentage === prev) return;
    prevPct.current = percentage;

    if (percentage < prev) {
      setDelta("damage");
      setGhost(prev);
      const t = setTimeout(() => setGhost(percentage), 450);
      return () => clearTimeout(t);
    }

    setDelta("heal");
    setGhost(percentage);
  }, [percentage]);

  // Clear the pop highlight once its animation has played.
  useEffect(() => {
    if (!delta) return;
    const t = setTimeout(() => setDelta(null), 700);
    return () => clearTimeout(t);
  }, [delta]);

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

  const critical = percentage > 0 && percentage <= 30;

  return (
    <div className={cn("flex-1", className)}>
      <div className="flex justify-between items-end mb-1.5">
        <span className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">{label}</span>
        <span
          className={cn(
            "text-sm font-mono font-bold tabular-nums transition-transform duration-300",
            getLabelColor(percentage),
            delta === "damage" && "scale-125",
            delta === "heal" && "scale-125 !text-celo-green",
          )}
        >
          {hp}
        </span>
      </div>
      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden border border-white/5 relative">
        {/* Ghost trail — lags behind on damage to show what was just lost */}
        <div
          className="absolute inset-y-0 left-0 bg-white/25 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${ghost}%` }}
        />
        <div
          className={cn(
            "h-full transition-all duration-700 ease-out rounded-full relative",
            getHpColor(percentage),
            critical && "animate-pulse",
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
