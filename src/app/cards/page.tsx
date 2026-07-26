"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Swords, Shield, Zap, Info, ChevronLeft } from "lucide-react";
import { CARDS, Card } from "@/constants/cards";
import { CardTile } from "@/components/ui/CardTile";
import { CardDetailSheet } from "@/components/ui/CardDetailSheet";
import { cn } from "@/lib/utils";

// Scale helpers for displaying Tier II and Tier III cards in the encyclopedia
function scaleTier(c: Card, tier: number, multiplier: number): Card {
  const suffix = tier === 2 ? "_t2" : "_t3";
  const label = tier === 2 ? "II" : "III";
  return {
    ...c,
    id: `${c.id}${suffix}`,
    name: `${c.name} ${label}`,
    tier,
    damage: Math.floor(c.damage * multiplier),
    shield: Math.floor(c.shield * multiplier),
    piercing: c.piercing ? Math.floor(c.piercing * multiplier) : undefined,
  };
}

const ALL_ENCYCLOPEDIA_CARDS: Card[] = [
  ...CARDS,
  ...CARDS.map((c) => scaleTier(c, 2, 1.3)),
  ...CARDS.map((c) => scaleTier(c, 3, 1.6)),
];

export default function CardsPage() {
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState<number | "all">("all");
  const [selectedType, setSelectedType] = useState<string | "all">("all");
  const [inspectCard, setInspectCard] = useState<Card | null>(null);

  const filteredCards = ALL_ENCYCLOPEDIA_CARDS.filter((card) => {
    if (selectedTier !== "all" && card.tier !== selectedTier) return false;
    if (selectedType !== "all" && card.type !== selectedType) return false;
    return true;
  });

  return (
    <main className="min-h-screen bg-duel-bg flex flex-col p-6 max-w-md mx-auto font-sans pb-24 relative animate-fade-in">
      {/* Top Header */}
      <header className="flex justify-between items-center mb-6">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground tracking-[0.2em] hover:text-white uppercase"
        >
          <ChevronLeft className="w-4 h-4" />
          HOME
        </button>
        <span className="text-sm font-black text-duel-gold tracking-[0.25em] uppercase">
          CARD ARSENAL
        </span>
        <span className="w-12" />
      </header>

      {/* Intro Banner */}
      <div className="glass border-duel-gold/20 p-5 rounded-2xl mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-duel-gold" />
        <h2 className="text-xs font-bold text-duel-gold tracking-widest uppercase mb-1">
          Tactical Database
        </h2>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Master the cards to defeat CIPHER. Tap any card below to view detailed stats, piercing values, and combat mechanics.
        </p>
      </div>

      {/* Tier Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 no-scrollbar">
        {[
          { label: "All Tiers", val: "all" },
          { label: "Tier I (0+ wins)", val: 1 },
          { label: "Tier II (5+ wins)", val: 2 },
          { label: "Tier III (15+ wins)", val: 3 },
        ].map((tab) => (
          <button
            key={String(tab.val)}
            onClick={() => setSelectedTier(tab.val as number | "all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border",
              selectedTier === tab.val
                ? "bg-duel-gold text-duel-bg border-duel-gold"
                : "glass border-white/5 text-muted-foreground hover:text-white",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Type Filter Buttons */}
      <div className="flex gap-2 mb-6">
        {[
          { label: "All Types", val: "all", icon: null },
          { label: "Attack", val: "attack", icon: Swords },
          { label: "Defend", val: "defend", icon: Shield },
          { label: "Special", val: "special", icon: Zap },
        ].map((typeTab) => {
          const Icon = typeTab.icon;
          return (
            <button
              key={typeTab.val}
              onClick={() => setSelectedType(typeTab.val)}
              className={cn(
                "flex-1 py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1 border transition-all",
                selectedType === typeTab.val
                  ? "bg-white/10 text-white border-white/20"
                  : "glass border-white/5 text-muted-foreground hover:text-white",
              )}
            >
              {Icon && <Icon className="w-3 h-3" />}
              {typeTab.label}
            </button>
          );
        })}
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {filteredCards.map((card, idx) => (
          <div
            key={card.id}
            className="w-full aspect-[2/3] animate-card-entrance flex"
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <CardTile
              card={card}
              onClick={() => setInspectCard(card)}
              className="w-full h-full"
            />
          </div>
        ))}
      </div>

      {/* How To Play Section */}
      <section className="glass border-white/5 p-6 rounded-2xl space-y-4">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-duel-gold" />
          <h3 className="text-xs font-bold text-duel-gold tracking-widest uppercase">
            Combat Rules & Mechanics
          </h3>
        </div>

        <div className="space-y-3 text-[11px] text-muted-foreground leading-relaxed">
          <div className="border-l-2 border-red-500/50 pl-3 space-y-0.5">
            <p className="font-bold text-white uppercase text-[10px]">1. 3 Turns to Victory</p>
            <p>Both players start with 100 HP. Play 1 card per turn over 3 turns. Higher HP at the end wins.</p>
          </div>

          <div className="border-l-2 border-duel-gold/50 pl-3 space-y-0.5">
            <p className="font-bold text-white uppercase text-[10px]">2. Clutch Turn (+10% Damage)</p>
            <p>Turn 3 is the Clutch Turn! All raw damage output is boosted by 10% (floor rounded).</p>
          </div>

          <div className="border-l-2 border-sky-500/50 pl-3 space-y-0.5">
            <p className="font-bold text-white uppercase text-[10px]">3. Hint System & Bluffing</p>
            <p>CIPHER broadcasts a card type hint before each turn. If CIPHER honors the hint, it gains +5 bonus shield (+6 T2, +8 T3).</p>
          </div>

          <div className="border-l-2 border-purple-500/50 pl-3 space-y-0.5">
            <p className="font-bold text-white uppercase text-[10px]">4. Drain & Lifesteal</p>
            <p>Drain cards bypass shields with Piercing damage and heal the caster for 50% of total damage dealt (capped at 100 HP).</p>
          </div>
        </div>
      </section>

      {/* Detail Sheet Modal */}
      <CardDetailSheet
        card={inspectCard}
        onClose={() => setInspectCard(null)}
      />
    </main>
  );
}
