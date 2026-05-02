"use client";

import { useState, useCallback, useEffect } from "react";
import { drawHand, Card } from "@/constants/cards";
import { initGameState, resolveTurn, GameState } from "@/lib/gameEngine";

export function useGameState() {
  const [hand, setHand] = useState<Card[]>([]);
  const [gameState, setGameState] = useState<GameState>(initGameState);
  const [phase, setPhase] = useState<"draw" | "pick" | "resolve" | "done">("draw");
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [aiCard, setAiCard] = useState<Card | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [usedCardIds, setUsedCardIds] = useState<Set<string>>(new Set());
  const [aiHintType, setAiHintType] = useState<string | null>(null);

  useEffect(() => {
    const totalWins = parseInt(localStorage.getItem('duel_total_wins') || '0');
    setHand(drawHand(totalWins));
  }, []);

  // Generate a new hint whenever we enter the pick phase
  useEffect(() => {
    if (phase === "pick") {
      const types = ["attack", "defend", "special"];
      const randomType = types[Math.floor(Math.random() * types.length)];
      setAiHintType(randomType);
    }
  }, [phase]);

  const playTurn = useCallback(async (playerCard: Card, onWin?: () => void) => {
    if (isLoading || usedCardIds.has(playerCard.id)) return;
    setIsLoading(true);
    setSelectedCard(playerCard);
    setPhase("resolve");

    try {
      const res = await fetch("/api/ai-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerCard,
          aiHp: gameState.aiHp,
          playerHp: gameState.playerHp,
          turn: gameState.turn,
          aiHintType, // Pass the bluff hint to the AI
          history: {
            streak: parseInt(localStorage.getItem('duel_streak') || '0'),
            totalWins: parseInt(localStorage.getItem('duel_total_wins') || '0'),
          }
        }),
      });


      const data = await res.json();
      const cipher: Card = data.card;
      const reasoning: string = data.reasoning;

      setAiCard(cipher);
      setAiReasoning(reasoning);

      await new Promise((r) => setTimeout(r, 1200));

      const newState = resolveTurn(gameState, playerCard, cipher);
      setGameState(newState);
      setUsedCardIds((prev) => new Set([...prev, playerCard.id]));

      if (newState.isOver) {
        if (newState.playerWon) {
          // Update local stats
          const streak = parseInt(localStorage.getItem('duel_streak') || '0') + 1;
          localStorage.setItem('duel_streak', streak.toString());
          const best = parseInt(localStorage.getItem('duel_best_streak') || '0');
          if (streak > best) localStorage.setItem('duel_best_streak', streak.toString());
          
          const totalWins = parseInt(localStorage.getItem('duel_total_wins') || '0') + 1;
          localStorage.setItem('duel_total_wins', totalWins.toString());

          onWin?.();
        } else {
          localStorage.setItem('duel_streak', '0');
        }
        
        setPhase("done");
      } else {
        setTimeout(() => {
          setAiCard(null);
          setSelectedCard(null);
          setAiReasoning("");
          setPhase("pick");
        }, 1800);
      }
    } catch (err) {
      console.error("Game error:", err);
      setPhase("pick");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, usedCardIds, gameState, aiHintType]);

  return {
    hand,
    gameState,
    phase,
    setPhase,
    selectedCard,
    aiCard,
    aiReasoning,
    isLoading,
    usedCardIds,
    aiHintType,
    playTurn
  };
}
