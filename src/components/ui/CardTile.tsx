"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Card, CARDS } from "@/constants/cards";
import { HINT_SHIELD_BONUS, previewDamage } from "@/lib/gameEngine";

// ── Per-card visual 3D identity ─────────────────────────────────────────────
// Each card gets a distinct 3D glassmorphic layer, radial background aura,
// metallic border, and colored drop-shadow glow.
const CARD_IDENTITY: Record<
  string,
  {
    gradient: string;
    selectedGradient: string;
    border: string;
    emojiGlow: string;
    nameColor: string;
    accentColor: string;
    auraBg: string;
  }
> = {
  strike: {
    gradient: "from-red-950 via-red-900/60 to-neutral-950",
    selectedGradient: "from-red-900 via-red-800 to-neutral-900",
    border: "border-red-600/50 shadow-[0_0_15px_rgba(220,38,38,0.2)]",
    emojiGlow: "drop-shadow-[0_0_14px_rgba(239,68,68,0.9)]",
    nameColor: "text-red-300",
    accentColor: "text-red-400",
    auraBg: "bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.2)_0%,transparent_70%)]",
  },
  block: {
    gradient: "from-blue-950 via-blue-900/60 to-neutral-950",
    selectedGradient: "from-blue-900 via-blue-800 to-neutral-900",
    border: "border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]",
    emojiGlow: "drop-shadow-[0_0_14px_rgba(59,130,246,0.9)]",
    nameColor: "text-blue-300",
    accentColor: "text-blue-400",
    auraBg: "bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.2)_0%,transparent_70%)]",
  },
  surge: {
    gradient: "from-amber-950 via-amber-900/70 to-neutral-950",
    selectedGradient: "from-yellow-900 via-amber-800 to-neutral-900",
    border: "border-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.25)]",
    emojiGlow: "drop-shadow-[0_0_18px_rgba(250,204,21,1)] animate-pulse",
    nameColor: "text-amber-300",
    accentColor: "text-amber-400",
    auraBg: "bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.25)_0%,transparent_70%)]",
  },
  counter: {
    gradient: "from-emerald-950 via-teal-900/70 to-neutral-950",
    selectedGradient: "from-teal-900 via-emerald-800 to-neutral-900",
    border: "border-teal-400/60 shadow-[0_0_20px_rgba(45,212,191,0.25)]",
    emojiGlow: "drop-shadow-[0_0_18px_rgba(45,212,191,0.9)]",
    nameColor: "text-teal-300",
    accentColor: "text-teal-400",
    auraBg: "bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.25)_0%,transparent_70%)]",
  },
  parry: {
    gradient: "from-slate-900 via-slate-800/70 to-neutral-950",
    selectedGradient: "from-slate-800 via-slate-700 to-neutral-900",
    border: "border-slate-400/50 shadow-[0_0_15px_rgba(148,163,184,0.2)]",
    emojiGlow: "drop-shadow-[0_0_14px_rgba(203,213,225,0.8)]",
    nameColor: "text-slate-300",
    accentColor: "text-slate-400",
    auraBg: "bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.18)_0%,transparent_70%)]",
  },
  drain: {
    gradient: "from-purple-950 via-fuchsia-950/80 to-neutral-950",
    selectedGradient: "from-fuchsia-900 via-purple-800 to-neutral-900",
    border: "border-fuchsia-500/60 shadow-[0_0_20px_rgba(217,70,239,0.3)]",
    emojiGlow: "drop-shadow-[0_0_20px_rgba(232,121,249,1)] animate-pulse",
    nameColor: "text-fuchsia-300",
    accentColor: "text-fuchsia-400",
    auraBg: "bg-[radial-gradient(circle_at_center,rgba(217,70,239,0.3)_0%,transparent_70%)]",
  },
};

const FALLBACK_IDENTITY = {
  gradient: "from-neutral-900/90 via-neutral-800/50 to-neutral-950",
  selectedGradient: "from-neutral-800/90 via-neutral-700/60 to-neutral-900",
  border: "border-white/20",
  emojiGlow: "drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]",
  nameColor: "text-white",
  accentColor: "text-muted-foreground",
  auraBg: "bg-transparent",
};

/** Strip _t2 / _t3 suffix to get base card ID. */
function baseId(cardId: string): string {
  return cardId.replace(/_t[23]$/, "");
}

/** Average shield of base-tier cards that match a given type. */
function avgShieldForType(type: string): number {
  const matching = CARDS.filter((c) => c.type === type);
  if (!matching.length) return 0;
  return Math.round(
    matching.reduce((sum, c) => sum + c.shield, 0) / matching.length,
  );
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
  const identity = CARD_IDENTITY[baseId(card.id)] ?? FALLBACK_IDENTITY;
  const isT3 = card.tier >= 3;
  const isT2 = card.tier === 2;
  const isDrain = baseId(card.id) === "drain";

  // ── Flipped / face-down (CIPHER's unrevealed card) ──────────────────────
  if (isFlipped) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "relative flex-1 group perspective-1000 w-full aspect-[2/3]",
          className,
        )}
      >
        <div
          className={cn(
            "w-full h-full aspect-[2/3] transition-all duration-500 rounded-xl flex flex-col items-center justify-center p-3 text-center border bg-gradient-to-br from-neutral-950 via-neutral-900 to-black border-duel-gold/25 shadow-[0_0_20px_rgba(252,196,25,0.05)]",
            selected &&
              "border-duel-gold scale-105 shadow-[0_0_25px_rgba(252,196,25,0.25)] animate-glow",
            !disabled &&
              "hover:border-duel-gold/50 hover:bg-neutral-900/80 hover:-translate-y-1 active:scale-95 active:duration-150 cursor-pointer",
          )}
        >
          <div className="absolute inset-1.5 border border-white/5 rounded-lg pointer-events-none flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full border border-duel-gold/15 flex items-center justify-center bg-duel-gold/5 animate-pulse">
              <span className="text-duel-gold/75 text-xs font-mono font-bold tracking-widest">
                CIPHER
              </span>
            </div>
          </div>
        </div>
      </button>
    );
  }

  // ── Damage preview vs hint ───────────────────────────────────────────────
  const baseShield = aiHintType ? avgShieldForType(aiHintType) : 0;
  const hintShield = aiHintType ? baseShield + HINT_SHIELD_BONUS : 0;
  const vsHint = aiHintType ? previewDamage(card, hintShield) : null;

  // ── Face-up card ─────────────────────────────────────────────────────────
  return (
    <button
      onClick={onClick}
      disabled={disabled || used}
      className={cn("relative flex-1 group perspective-1000 w-full aspect-[2/3]", className)}
    >
      <div
        className={cn(
          // Base layout with fixed 2/3 aspect ratio
          "w-full h-full aspect-[2/3] transition-all duration-300 rounded-xl flex flex-col items-center p-2 text-center border relative overflow-hidden shadow-md",
          // Identity 3D gradient
          `bg-gradient-to-b ${selected ? identity.selectedGradient : identity.gradient}`,
          identity.border,
          // Tier enhancements
          isT2 && !selected && "border-slate-400/50",
          isT3 && !selected && "border-duel-gold/55 card-t3-glow",
          // Selected state
          selected &&
            "scale-105 ring-2 ring-duel-gold ring-offset-[2px] ring-offset-duel-bg brightness-110 shadow-xl",
          // Used state
          used && "opacity-25 grayscale cursor-not-allowed",
          // Hover / active
          !used &&
            !disabled &&
            "hover:-translate-y-1.5 hover:brightness-110 hover:scale-[1.03] active:scale-95 active:duration-150 cursor-pointer",
        )}
      >
        {/* Radial 3D background aura */}
        <div
          className={cn(
            "absolute inset-0 pointer-events-none rounded-xl transition-opacity duration-300",
            identity.auraBg,
          )}
        />

        {/* Tier shimmer overlay */}
        {(isT2 || isT3) && !used && (
          <div
            className={cn(
              "absolute inset-0 pointer-events-none rounded-xl",
              isT3 ? "card-shimmer-t3" : "card-shimmer-t2",
            )}
          />
        )}

        {/* Tier badge */}
        <div className="absolute top-1.5 right-1.5 z-10">
          <span
            className={cn(
              "text-[6px] font-black px-1 py-0.5 rounded border uppercase tracking-tight leading-none",
              card.tier === 1 &&
                "bg-white/10 text-muted-foreground border-white/10",
              card.tier === 2 &&
                "bg-slate-400/20 text-slate-300 border-slate-400/30",
              card.tier >= 3 &&
                "bg-duel-gold/25 text-duel-gold border-duel-gold/45",
            )}
          >
            {card.tier === 1 ? "I" : card.tier === 2 ? "II" : "III"}
          </span>
        </div>

        {/* Emoji — large, colored 3D drop-shadow glow */}
        <div className="flex-1 flex items-center justify-center w-full relative z-10">
          <span
            className={cn(
              "text-3xl filter transition-transform duration-200 group-hover:scale-110 group-active:scale-90 select-none",
              identity.emojiGlow,
              isT3 && "text-4xl",
            )}
          >
            {card.emoji}
          </span>
        </div>

        {/* Card name & stats footer */}
        <div className="w-full mt-auto space-y-1 z-10 shrink-0">
          <p
            className={cn(
              "text-[8px] font-black tracking-wide uppercase truncate leading-none",
              isT3 ? "text-duel-gold" : identity.nameColor,
            )}
          >
            {card.name}
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap gap-0.5 justify-center items-center">
            {card.damage > 0 && (
              <span className="text-[7px] font-bold text-red-400/90 bg-red-900/40 px-1 py-0.5 rounded border border-red-700/30 leading-none">
                {card.damage}⚔
              </span>
            )}
            {card.shield > 0 && (
              <span className="text-[7px] font-bold text-sky-400/90 bg-sky-900/40 px-1 py-0.5 rounded border border-sky-700/30 leading-none">
                {card.shield}🛡
              </span>
            )}
            {card.piercing != null && card.piercing > 0 && (
              <span className="text-[7px] font-bold text-purple-300 bg-purple-950/80 px-1 py-0.5 rounded border border-purple-500/40 leading-none shadow-[0_0_6px_rgba(192,132,252,0.4)]">
                {card.piercing}⚡
              </span>
            )}
            {isDrain && (
              <span className="text-[7px] font-black text-emerald-300 bg-emerald-950/80 px-1 py-0.5 rounded border border-emerald-500/40 leading-none shadow-[0_0_6px_rgba(52,211,153,0.4)] flex items-center gap-0.5">
                <span className="text-[8px] font-black text-emerald-400 leading-none">+</span>50% HP
              </span>
            )}
          </div>

          {/* Hint damage preview */}
          {vsHint !== null && card.damage > 0 && (
            <div className="w-full mt-0.5">
              <span className="text-[7px] font-bold text-duel-gold/85 bg-duel-gold/10 px-1 py-0.5 rounded border border-duel-gold/25 w-full block truncate leading-none">
                ~{vsHint} vs hint
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
