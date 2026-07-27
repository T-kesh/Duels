"use client";

import React from "react";
import { X, Swords, Shield, Zap, Info, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/constants/cards";
import { getCombosForCard } from "@/lib/combos";

interface CardDetailSheetProps {
  card: Card | null;
  onClose: () => void;
}

export function CardDetailSheet({ card, onClose }: CardDetailSheetProps) {
  if (!card) return null;

  const isT3 = card.tier >= 3;
  const isT2 = card.tier === 2;
  const combos = getCombosForCard(card.id);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm animate-fade-in p-4">
      {/* Backdrop tap to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet Container */}
      <div className="relative w-full max-w-sm glass border border-duel-gold/30 rounded-3xl p-6 shadow-2xl bg-neutral-950/90 animate-slide-up z-10 space-y-5 overflow-hidden">
        {/* Top bar with tier badge + close button */}
        <div className="flex justify-between items-center">
          <span
            className={cn(
              "text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider",
              card.tier === 1 && "bg-white/10 text-muted-foreground border-white/10",
              card.tier === 2 && "bg-slate-400/20 text-slate-300 border-slate-400/30",
              card.tier >= 3 && "bg-duel-gold/25 text-duel-gold border-duel-gold/45",
            )}
          >
            Tier {card.tier === 1 ? "I • Common" : card.tier === 2 ? "II • Rare" : "III • Epic"}
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Big Card Visual Showcase */}
        <div className="flex flex-col items-center text-center space-y-2 py-2">
          <div
            className={cn(
              "w-24 h-24 rounded-2xl flex items-center justify-center text-5xl border shadow-xl bg-gradient-to-b from-white/5 to-white/[0.02]",
              isT3 && "border-duel-gold/50 card-t3-glow",
              isT2 && "border-slate-400/40",
              !isT2 && !isT3 && "border-white/15",
            )}
          >
            <span className="filter drop-shadow-md">{card.emoji}</span>
          </div>

          <h3
            className={cn(
              "text-lg font-black tracking-widest uppercase mt-2",
              isT3 ? "text-duel-gold" : "text-white",
            )}
          >
            {card.name}
          </h3>

          <p className="text-xs text-muted-foreground leading-relaxed px-4">
            {card.description}
          </p>
        </div>

        {/* Detailed Combat Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-red-950/30 border border-red-800/30 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
              <Swords className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[8px] font-bold text-muted-foreground tracking-wider uppercase">Attack Damage</p>
              <p className="text-sm font-mono font-bold text-red-400">{card.damage} HP</p>
            </div>
          </div>

          <div className="bg-sky-950/30 border border-sky-800/30 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[8px] font-bold text-muted-foreground tracking-wider uppercase">Shield Block</p>
              <p className="text-sm font-mono font-bold text-sky-400">{card.shield} HP</p>
            </div>
          </div>

          {card.piercing != null && card.piercing > 0 && (
            <div className="bg-purple-950/30 border border-purple-800/30 rounded-xl p-3 flex items-center gap-3 col-span-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <Zap className="w-4 h-4" fill="currentColor" />
              </div>
              <div>
                <p className="text-[8px] font-bold text-muted-foreground tracking-wider uppercase">Piercing / Lifesteal</p>
                <p className="text-xs font-mono font-bold text-purple-300">
                  {card.piercing} Shield Bypass • 50% Lifesteal
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Combos */}
        {combos.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-[10px] font-bold text-duel-gold tracking-widest uppercase flex items-center gap-1.5">
              <Flame className="w-3 h-3" />
              Synergy & Combos
            </h4>
            <div className="flex flex-col gap-2">
              {combos.map((combo) => (
                <div key={combo.name} className="bg-white/5 border border-white/10 rounded-lg p-2.5 flex items-start gap-2.5">
                  <div className="text-xl leading-none">{combo.emoji}</div>
                  <div>
                    <p className="text-[11px] font-bold text-white tracking-wide uppercase mb-0.5">{combo.name}</p>
                    <p className="text-[9px] text-muted-foreground leading-snug">{combo.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Note */}
        <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-start gap-2 text-[10px] text-muted-foreground">
          <Info className="w-3.5 h-3.5 text-duel-gold shrink-0 mt-0.5" />
          <p className="leading-snug">
            On Turn 3 (Clutch Turn), all damage output increases by +10%. Honor CIPHER&apos;s hints to mitigate counter-shield bonuses!
          </p>
        </div>
      </div>
    </div>
  );
}
