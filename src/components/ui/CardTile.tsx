"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/constants/cards";

interface CardTileProps {
  card: Card;
  onClick?: () => void;
  used?: boolean;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
  isRevealed?: boolean;
}

export function CardTile({
  card,
  onClick,
  used,
  selected,
  disabled,
  className,
  isRevealed = true,
}: CardTileProps) {
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
        selected && "border-duel-gold bg-duel-gold/10 scale-105 shadow-[0_0_20px_rgba(252,196,25,0.2)]",
        used && "opacity-30 grayscale cursor-not-allowed",
        !used && !disabled && "hover:border-duel-gold/40 hover:bg-white/5 hover:-translate-y-1 cursor-pointer",
      )}>
        {/* Tier Badge */}
        <div className="absolute top-2 right-2">
          {card.tier > 1 && (
            <span className={cn(
              "text-[7px] font-bold px-1 py-0.5 rounded uppercase tracking-tighter",
              card.tier === 2 ? "bg-slate-400/20 text-slate-300" : "bg-duel-gold/20 text-duel-gold"
            )}>
              T{card.tier}
            </span>
          )}
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
              -{card.damage} HP
            </span>
          )}
          {card.shield > 0 && (
            <span className="text-[8px] font-bold text-sky-400 bg-sky-400/10 px-1.5 py-0.5 rounded-md border border-sky-400/20">
              +{card.shield} DEF
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
