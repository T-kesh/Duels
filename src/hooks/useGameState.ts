"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import type { Card } from "@/constants/cards";
import { initGameState, type GameState, type TurnResult } from "@/lib/gameEngine";
import { pushRecentDuelOutcome, readRecentDuels } from "@/lib/recentDuels";

type ApiPublicState = {
  playerHp: number;
  aiHp: number;
  turn: number;
  isOver: boolean;
  playerWon: boolean | null;
  lastTurn: TurnResult | null;
  turnsCount?: number;
  perfectDuelBonus?: boolean;
};

function mergeFromApi(prev: GameState, patch: ApiPublicState): GameState {
  const shouldAppendLastTurn =
    Boolean(patch.lastTurn) &&
    (typeof patch.turnsCount !== "number" || patch.turnsCount > prev.turns.length);
  const turns = shouldAppendLastTurn && patch.lastTurn ? [...prev.turns, patch.lastTurn] : prev.turns;
  return {
    playerHp: patch.playerHp,
    aiHp: patch.aiHp,
    turn: patch.turn,
    isOver: patch.isOver,
    playerWon: patch.playerWon,
    turns,
  };
}

export function useGameState() {
  const { address } = useAccount();
  const [duelId, setDuelId] = useState<string | null>(null);
  const [hand, setHand] = useState<Card[]>([]);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [dealingDeck, setDealingDeck] = useState<boolean>(false);
  const [lastDamageFlash, setLastDamageFlash] = useState<{
    player: number;
    ai: number;
  } | null>(null);
  const [perfectDuelToast, setPerfectDuelToast] = useState(false);

  const [gameState, setGameState] = useState<GameState>(initGameState);
  const [phase, setPhase] = useState<"draw" | "pick" | "resolve" | "done">("draw");
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [aiCard, setAiCard] = useState<Card | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [usedCardIds, setUsedCardIds] = useState<Set<string>>(new Set());
  const [aiHintType, setAiHintType] = useState<string | null>(null);
  const [turnError, setTurnError] = useState<string | null>(null);

  const turnInFlight = useRef(false);

  const beginDuel = useCallback(async () => {
    if (!address) {
      setStartupError("Connect your wallet to duel.");
      return false;
    }

    setDealingDeck(true);
    setStartupError(null);

    try {
      const res = await fetch("/api/start-duel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerAddress: address }),
      });

      const payload = await res.json();

      if (!res.ok) {
        if (payload.error === "no_energy") {
          throw new Error("Out of energy. Wait for recharge or top up.");
        }
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }

      setDuelId(payload.duelId);
      setHand(payload.hand);
      setGameState(initGameState());
      setUsedCardIds(new Set());
      window.dispatchEvent(new Event("player-state-update"));
      return true;
    } catch (e) {
      console.error(e);
      setStartupError(
        e instanceof Error ? e.message : "Could not securely deal a duel. Try again.",
      );
      return false;
    } finally {
      setDealingDeck(false);
    }
  }, [address]);

  useEffect(() => {
    if (phase === "pick") {
      const types = ["attack", "defend", "special"];
      const randomType = types[Math.floor(Math.random() * types.length)] as string;
      setAiHintType(randomType);
    }
  }, [phase]);

  const playTurn = useCallback(
    async (playerCard: Card, onWin?: (id: string | null) => void) => {
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

        if (!res.ok || !data?.card || !data?.state) {
          throw new Error(data?.error ?? "ai_move_failed");
        }

        setAiCard(data.card as Card);
        setAiReasoning(String(data.reasoning ?? ""));

        await new Promise((r) => setTimeout(r, 1200));

        const patch = data.state as ApiPublicState;
        let nextSnap!: GameState;

        setGameState((prev) => {
          nextSnap = mergeFromApi(prev, patch);
          if (patch.lastTurn) {
            setLastDamageFlash({
              player: patch.lastTurn.aiDamageDealt,
              ai: patch.lastTurn.playerDamageDealt,
            });
            setTimeout(() => setLastDamageFlash(null), 1200);
          }
          return nextSnap;
        });

        setUsedCardIds((prev) => new Set([...prev, playerCard.id]));

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

            if (patch.perfectDuelBonus) {
              setPerfectDuelToast(true);
              setTimeout(() => setPerfectDuelToast(false), 4000);
              window.dispatchEvent(new Event("player-state-update"));
            }

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
        console.error("Game error:", err);

        const msg =
          err instanceof DOMException && err.name === "AbortError"
            ? "CIPHER took too long to respond. Tap your card again."
            : "Connection lost. Tap your card to retry.";

        setTurnError(msg);
        setAiCard(null);
        setAiReasoning("");

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
    lastDamageFlash,
    perfectDuelToast,
    beginDuel,
    playTurn,
  };
}
