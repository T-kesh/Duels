"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface BattleArenaProps {
  children: React.ReactNode;
  className?: string;
}

export function BattleArena({ children, className }: BattleArenaProps) {
  return (
    <div className={cn(
      "flex-1 glass border-white/5 rounded-2xl p-6 mb-6 flex flex-col items-center justify-center relative overflow-hidden",
      className
    )}>
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-duel-gold/5 rounded-full blur-3xl pointer-events-none" />
      
      {children}
    </div>
  );
}
