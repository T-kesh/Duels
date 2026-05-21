"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Card } from "@/constants/cards";
import { initGameState, type GameState } from "@/lib/gameEngine";
import { pushRecentDuelOutcome, readRecentDuels } from "@/lib/recentDuels";

export function useGameState() {
  const [duelId, setDuelId] = useState<string | null>(null);
  const [hand, setHand] = useState<Card[]>([]);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [dealingDeck, setDealingDeck] = useState<boolean>(true);

  const [gameState, setGameState] = useState<GameState>(initGameState);
  const [phase, setPhase] = useState<"draw" | "pick" | "resolve" | "done">("draw");
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [aiCard, setAiCard] = useState<Card | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [usedCardIds, setUsedCardIds] = useState<Set<string>>(new Set());
  const [aiHintType, setAiHintType] = useState<string | null>(null);
  const [turnError, setTurnError] = useState<string | null>(null);

  // Track whether a turn is in-flight to prevent double-taps
  const turnInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function deal() {
      setDealingDeck(true);
      setStartupError(null);
      try {
        const totalWins = parseInt(localStorage.getItem("duel_total_wins") ?? "0", 10);
        const res = await fetch("/api/start-duel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ totalWins }),
        });

        const payload = await res.json();

        if (!res.ok) {
          throw new Error(payload.error ?? `HTTP ${res.status}`);
        }

        if (cancelled) return;

        setDuelId(payload.duelId);
        setHand(payload.hand);
        setGameState(initGameState());
      } catch (e) {
        console.error(e);
        if (!cancelled) setStartupError("Could not securely deal a duel. Refresh to retry.");
      } finally {
        if (!cancelled) setDealingDeck(false);
      }
    }

    deal();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase === "pick") {
      const types = ["attack", "defend", "special"];
      const randomType = types[Math.floor(Math.random() * types.length)] as string;
      setAiHintType(randomType);
    }
  }, [phase]);

  const playTurn = useCallback(
    async (playerCard: Card, onWin?: (due: string | null) => void) => {
      if (!duelId) return;
      if (turnInFlight.current || usedCardIds.has(playerCard.id)) return;

      turnInFlight.current = true;
      setIsLoading(true);
      setSelectedCard(playerCard);
      setAiCard(null);
      setAiReasoning("");
      setTurnError(null);
      setPhase("resolve");

      try {
        const recent = readRecentDuels(3).map(({ won, playerHp, aiHp }) => ({
          won,
          playerHp,
          aiHp,
        }));

        // 25-second timeout — Vercel functions can take up to 10s,
        // plus Claude API latency on top of that
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25_000);

        const res = await fetch("/api/ai-move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            duelId,
            playerCard,
            aiHintType: aiHintType ?? "special",
            history: {
              streak: parseInt(localStorage.getItem("duel_streak") || "0", 10),
              totalWins: parseInt(localStorage.getItem("duel_total_wins") || "0", 10),
            },
            recentDuels: recent,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const data = await res.json();

        if (!res.ok || !data?.card || !data?.gameState) {
          throw new Error(data?.error ?? "ai_move_failed");
        }

        // ── Success path ──────────────────────────────────────────────
        setAiCard(data.card as Card);
        setAiReasoning(String(data.reasoning ?? ""));

        await new Promise((r) => setTimeout(r, 1200));

        const nextSnap = data.gameState as GameState;
        setGameState(nextSnap);

        const usedTurnId = playerCard.id;
        setUsedCardIds((prev) => new Set([...prev, usedTurnId]));

        if (nextSnap.isOver) {
          pushRecentDuelOutcome({
            won: !!nextSnap.playerWon,
            playerHp: nextSnap.playerHp,
            aiHp: nextSnap.aiHp,
          });
        }

        if (nextSnap.isOver) {
          if (nextSnap.playerWon) {
            const streak = parseInt(localStorage.getItem("duel_streak") ?? "0", 10) + 1;
            localStorage.setItem("duel_streak", streak.toString());

            const best = parseInt(localStorage.getItem("duel_best_streak") ?? "0", 10);
            if (streak > best) localStorage.setItem("duel_best_streak", streak.toString());

            const wins = parseInt(localStorage.getItem("duel_total_wins") ?? "0", 10) + 1;
            localStorage.setItem("duel_total_wins", wins.toString());

            onWin?.(duelId);
          } else {
            localStorage.setItem("duel_streak", "0");
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
      } catch (err: unknown) {
        // ── Error path — show message, let player retry the same card ──
        console.error("Game error:", err);

        const msg =
          err instanceof DOMException && err.name === "AbortError"
            ? "CIPHER took too long to respond. Tap your card again."
            : "Connection lost. Tap your card to retry.";

        setTurnError(msg);
        setAiCard(null);
        setAiReasoning("");

        // Return to pick so the player can retry (card NOT marked as used)
        setTimeout(() => {
          setSelectedCard(null);
          setPhase("pick");
        }, 600);
      } finally {
        setIsLoading(false);
        turnInFlight.current = false;
      }
    },
    [usedCardIds, duelId, aiHintType],
  );

  return {
    duelId,
    hand,
    startupError,
    dealingDeck,
    gameState,
    phase,
    setPhase,
    selectedCard,
    aiCard,
    aiReasoning,
    isLoading,
    usedCardIds,
    aiHintType,
    turnError,
    playTurn,
  };
}

