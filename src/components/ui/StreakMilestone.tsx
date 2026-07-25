"use client";

import React, { useEffect, useState } from "react";
import { Flame, Crown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakMilestoneProps {
  streak: number;
  className?: string;
}

export function StreakMilestone({ streak, className }: StreakMilestoneProps) {
  const [showGoldFlash, setShowGoldFlash] = useState(false);

  useEffect(() => {
    if (streak >= 5) {
      setShowGoldFlash(true);
      const timer = setTimeout(() => setShowGoldFlash(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [streak]);

  if (streak < 3) return null;

  const isFire = streak >= 3 && streak < 5;
  const isOnFire = streak >= 5 && streak < 10;
  const isLegend = streak >= 10;

  return (
    <>
      {/* Gold screen flash overlay for 5+ streak */}
      {showGoldFlash && (
        <div className="fixed inset-0 z-50 bg-duel-gold pointer-events-none animate-gold-flash" />
      )}

      <div
        className={cn(
          "inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass border transition-all duration-500 shadow-xl",
          isFire && "border-orange-500/40 bg-orange-950/20 streak-fire-border text-orange-400",
          isOnFire && "border-duel-gold/60 bg-duel-gold/10 card-t3-glow text-duel-gold scale-105",
          isLegend && "border-yellow-400 bg-yellow-500/20 card-t3-glow text-yellow-300 scale-110 animate-bounce",
          className,
        )}
      >
        {isLegend ? (
          <Crown className="w-4 h-4 text-yellow-300 animate-spin [animation-duration:6s]" fill="currentColor" />
        ) : isOnFire ? (
          <Zap className="w-4 h-4 text-duel-gold animate-bounce" fill="currentColor" />
        ) : (
          <Flame className="w-4 h-4 text-orange-400 animate-pulse" fill="currentColor" />
        )}

        <span className="text-xs font-black tracking-widest uppercase">
          {streak} Win Streak {isLegend ? "• LEGENDARY!" : isOnFire ? "• ON FIRE!" : "• DOMINATING"}
        </span>
      </div>
    </>
  );
}
