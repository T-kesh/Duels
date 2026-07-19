"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Card, CARDS } from "@/constants/cards";
import { HINT_SHIELD_BONUS, previewDamage } from "@/lib/gameEngine";

/** Average shield of base-tier cards that match a given type. */
function avgShieldForType(type: string): number {
  const matching = CARDS.filter((c) => c.type === type);
  if (!matching.length) return 0;
  return Math.round(matching.reduce((sum, c) => sum + c.shield, 0) / matching.length);
}

interface CardTileProps {
  card: Card;
  onClick?: () => void;
  used?: boolean;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
  isFlipped?: boolean;
  /** When set, show damage preview vs a hinted defend (honest hint). */
  aiHintType?: string | null;
}

export function CardTile({
  card,
  onClick,
  used,
  selected,
  disabled,
  className,
  isFlipped,
  aiHintType,
}: CardTileProps) {
  if (isFlipped) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "relative flex-1 group perspective-1000 w-full aspect-[2/3]",
          className
        )}
      >
        <div className={cn(
          "w-full h-full transition-all duration-500 preserve-3d rounded-xl flex flex-col items-center justify-center p-3 text-center border border-duel-gold/25 bg-gradient-to-br from-neutral-950 via-neutral-900 to-black shadow-[0_0_20px_rgba(252,196,25,0.05)]",
          selected && "border-duel-gold scale-105 shadow-[0_0_25px_rgba(252,196,25,0.25)] animate-glow",
          !disabled && "hover:border-duel-gold/50 hover:bg-neutral-900/80 hover:-translate-y-1 active:scale-95 active:duration-150 cursor-pointer"
        )}>
          {/* Cosmic matrix design */}
          <div className="absolute inset-1.5 border border-white/5 rounded-lg pointer-events-none flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full border border-duel-gold/15 flex items-center justify-center bg-duel-gold/5 animate-pulse">
              <span className="text-duel-gold/75 text-xs font-mono font-bold tracking-widest">CIPHER</span>
            </div>
          </div>
        </div>
      </button>
    );
  }

  // Estimate CIPHER's effective shield based on the hinted card type.
  // Uses the average shield of base-tier cards of that type from the real
  // pool, plus HINT_SHIELD_BONUS only when the hint type would be honored.
  const baseShield = aiHintType ? avgShieldForType(aiHintType) : 0;
  const hintShield = aiHintType ? baseShield + HINT_SHIELD_BONUS : 0;
  const vsHint = previewDamage(card, hintShield);
  return (
    <button
      onClick={onClick}
      disabled={disabled || used}
      className={cn(
        "relative flex-1 group perspective-1000",
        className
      )}
    >
      <div className={cn(
        "w-full aspect-[2/3] transition-all duration-500 preserve-3d glass rounded-xl flex flex-col items-center justify-center p-3 text-center border-white/5",
        card.tier === 2 && "border-slate-400/30 bg-slate-400/5 shadow-[0_0_15px_rgba(148,163,184,0.1)]",
        card.tier === 3 && "border-duel-gold/30 bg-duel-gold/5 shadow-[0_0_20px_rgba(252,196,25,0.15)]",
        selected && "border-duel-gold bg-duel-gold/10 scale-105 shadow-[0_0_20px_rgba(252,196,25,0.2)] animate-glow",
        used && "opacity-30 grayscale cursor-not-allowed",
        !used && !disabled && "hover:border-duel-gold/40 hover:bg-white/5 hover:-translate-y-1 active:scale-95 active:duration-150 cursor-pointer",
      )}>
        <div className="absolute top-2 right-2">
          <span
            className={cn(
              "text-[7px] font-bold px-1 py-0.5 rounded uppercase tracking-tighter",
              card.tier === 1 && "bg-white/10 text-muted-foreground",
              card.tier === 2 && "bg-slate-400/20 text-slate-300",
              card.tier >= 3 && "bg-duel-gold/20 text-duel-gold",
            )}
          >
            {card.tier === 1 ? "I" : card.tier === 2 ? "II" : "III"}
          </span>
        </div>

        {/* Card Content */}
        <span className="text-3xl mb-2 filter drop-shadow-sm group-hover:scale-110 transition-transform">{card.emoji}</span>
        <span className={cn(
          "text-[10px] font-bold tracking-wider uppercase mb-2",
          card.tier === 3 ? "text-duel-gold" : "text-white"
        )}>{card.name}</span>
        
        <div className="flex flex-wrap justify-center gap-1 mt-auto">
          {card.damage > 0 && (
            <span className="text-[8px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-md border border-destructive/20">
              −{card.damage} ATK
            </span>
          )}
          {card.shield > 0 && (
            <span className="text-[8px] font-bold text-sky-400 bg-sky-400/10 px-1.5 py-0.5 rounded-md border border-sky-400/20">
              +{card.shield} DEF
            </span>
          )}
          {card.piercing && card.piercing > 0 && (
            <span className="text-[8px] font-bold text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded-md border border-purple-400/20">
              ⚡ {card.piercing} PRC
            </span>
          )}
          {aiHintType && card.damage > 0 && (
            <span className="text-[8px] font-bold text-duel-gold/80 bg-duel-gold/10 px-1.5 py-0.5 rounded-md border border-duel-gold/20 w-full">
              ~{vsHint} vs hint
            </span>
          )}
        </div>
        
        <p className="text-[9px] text-muted-foreground mt-2 leading-tight hidden sm:block">
          {card.description}
        </p>
      </div>
    </button>
  );
}
