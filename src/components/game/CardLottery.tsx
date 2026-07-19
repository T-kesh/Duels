"use client";

import React, { useState, useEffect } from "react";
import { CardTile } from "@/components/ui/CardTile";
import { GlowButton } from "@/components/ui/GlowButton";
import type { Card } from "@/constants/cards";

interface CardLotteryProps {
  dealtPool: Card[];
  onConfirm: (pickedCardIds: string[]) => Promise<void>;
  isLoading: boolean;
}

type Step = "reveal" | "flipping" | "shuffle" | "pick";

export function CardLottery({ dealtPool, onConfirm, isLoading }: CardLotteryProps) {
  const [step, setStep] = useState<Step>("reveal");
  const [visiblePool, setVisiblePool] = useState<Card[]>([...dealtPool]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [revealTimeLeft, setRevealTimeLeft] = useState(2.0);

  // 1. Reveal Countdown
  useEffect(() => {
    if (step !== "reveal") return;
    const interval = setInterval(() => {
      setRevealTimeLeft((prev) => {
        if (prev <= 0.1) {
          clearInterval(interval);
          setStep("flipping");
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [step]);

  // 2. Flip and Shuffle sequence
  useEffect(() => {
    if (step === "flipping") {
      const timer = setTimeout(() => {
        setStep("shuffle");
      }, 500);
      return () => clearTimeout(timer);
    }

    if (step === "shuffle") {
      let shuffleCount = 0;
      const maxShuffles = 8;
      const interval = setInterval(() => {
        setVisiblePool((prev) => {
          // Unbiased shuffle of positions
          const arr = [...prev];
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return arr;
        });

        shuffleCount++;
        if (shuffleCount >= maxShuffles) {
          clearInterval(interval);
          setStep("pick");
        }
      }, 225); // 8 shuffles * 225ms = 1.8s (exactly matching globals.css animation cycle)

      return () => clearInterval(interval);
    }
  }, [step]);

  const handleCardClick = (cardId: string) => {
    if (step !== "pick" || isLoading) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else if (next.size < 3) {
        next.add(cardId);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    if (selectedIds.size !== 3 || isLoading) return;
    onConfirm(Array.from(selectedIds));
  };

  return (
    <div className="w-full h-full flex flex-col justify-between items-center py-4 animate-fade-in">
      {/* Title section */}
      <div className="text-center w-full mb-4">
        {step === "reveal" && (
          <>
            <h2 className="text-duel-gold text-sm font-bold tracking-[0.3em] uppercase mb-1">
              Reveal Dealt Pool
            </h2>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase">
              Flipping cards in {revealTimeLeft.toFixed(1)}s...
            </p>
            {/* Progress bar */}
            <div className="w-24 h-0.5 bg-white/5 mx-auto mt-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-duel-gold transition-all duration-100 ease-linear"
                style={{ width: `${(revealTimeLeft / 2.0) * 100}%` }}
              />
            </div>
          </>
        )}
        {step === "flipping" && (
          <h2 className="text-white/60 text-sm font-bold tracking-[0.3em] uppercase animate-pulse">
            Flipping Cards...
          </h2>
        )}
        {step === "shuffle" && (
          <h2 className="text-duel-gold text-sm font-bold tracking-[0.3em] uppercase animate-pulse">
            Shuffling Pool...
          </h2>
        )}
        {step === "pick" && (
          <>
            <h2 className="text-duel-gold text-sm font-bold tracking-[0.3em] uppercase mb-1">
              Lottery Draft
            </h2>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase">
              Tap 3 cards to claim your hand ({selectedIds.size} / 3)
            </p>
          </>
        )}
      </div>

      {/* Grid of 6 cards */}
      <div className="grid grid-cols-3 gap-2.5 w-full my-auto max-w-[340px]">
        {visiblePool.map((card, i) => {
          const isFlipped = step !== "reveal";
          const isSelected = selectedIds.has(card.id);
          return (
            <div
              key={card.id}
              className={`transition-all duration-300 transform ${step === "shuffle" ? `animate-shuffle-${i}` : ""}`}
            >
              <CardTile
                card={card}
                isFlipped={isFlipped}
                selected={isSelected}
                disabled={step !== "pick" || isLoading}
                onClick={() => handleCardClick(card.id)}
                className="w-full h-full"
              />
            </div>
          );
        })}
      </div>

      {/* Confirmation footer */}
      <div className="w-full mt-6 flex justify-center h-12 items-center">
        {step === "pick" && selectedIds.size === 3 && (
          <div className="animate-slide-up">
            <GlowButton onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? "Locking Hand..." : "Confirm Hand"}
            </GlowButton>
          </div>
        )}
      </div>
    </div>
  );
}
