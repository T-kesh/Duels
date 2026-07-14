"use client";

import { CardTile } from "@/components/ui/CardTile";
import type { Card } from "@/constants/cards";

interface PlayerHandProps {
  hand: Card[];
  usedCardIds: Set<string>;
  selectedCard: Card | null;
  disabled: boolean;
  showCount: boolean;
  aiHintType?: string | null;
  onSelect: (card: Card) => void;
}

export function PlayerHand({
  hand,
  usedCardIds,
  selectedCard,
  disabled,
  showCount,
  aiHintType,
  onSelect,
}: PlayerHandProps) {
  return (
    <footer className="mt-auto pt-6">
      <div className="flex justify-between items-center mb-4">
        <span className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
          Your Hand
        </span>
        {showCount && (
          <span className="text-[9px] text-duel-gold/50 font-mono">
            {hand.length - usedCardIds.size} / {hand.length} CARDS
          </span>
        )}
      </div>

      <div className="flex gap-3 h-36">
        {hand.map((card, i) => (
          <div
            key={card.id}
            className="flex-1 flex animate-deal-in"
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <CardTile
              card={card}
              used={usedCardIds.has(card.id)}
              selected={selectedCard?.id === card.id}
              disabled={disabled}
              aiHintType={aiHintType}
              onClick={() => onSelect(card)}
            />
          </div>
        ))}
      </div>
    </footer>
  );
}
