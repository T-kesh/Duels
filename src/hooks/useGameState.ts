"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAccount, useSignMessage } from "wagmi";
import type { Card } from "@/constants/cards";
import { initGameState, type GameState, type TurnResult } from "@/lib/gameEngine";
import { pushRecentDuelOutcome } from "@/lib/recentDuels";

type ApiPublicState = {
  playerHp: number;
  aiHp: number;
  turn: number;
  isOver: boolean;
  playerWon: boolean | null;
  lastTurn: TurnResult | null;
  perfectDuelBonus?: boolean;
};

function mergeFromApi(prev: GameState, patch: ApiPublicState): GameState {
  const turns = patch.lastTurn ? [...prev.turns, patch.lastTurn] : prev.turns;
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
  const { signMessageAsync } = useSignMessage();
  const [duelId, setDuelId] = useState<string | null>(null);
  const [hand, setHand] = useState<Card[]>([]);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [dealingDeck, setDealingDeck] = useState<boolean>(false);
  const [lastDamageFlash, setLastDamageFlash] = useState<{
    player: number;
    ai: number;
  } | null>(null);
  const [perfectDuelToast, setPerfectDuelToast] = useState(false);
  const [visualHp, setVisualHp] = useState<{ player: number; ai: number } | null>(null);
  const [healFlash, setHealFlash] = useState<{ player: number; ai: number } | null>(null);

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
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const beginDuel = useCallback(async () => {
    if (!address) {
      setStartupError("Connect your wallet to duel.");
      return false;
    }

    setDealingDeck(true);
    setStartupError(null);
    setTurnError(null);

    try {
      // 1. Get a one-time challenge nonce for this address.
      const challengeRes = await fetch("/api/start-duel/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const challengePayload = await challengeRes.json();
      if (!challengeRes.ok) {
        throw new Error(challengePayload.error ?? `HTTP ${challengeRes.status}`);
      }

      // 2. Prove wallet ownership by signing the challenge message. This is a
      // read-only signature request — it never costs gas and doesn't touch
      // funds, just proves the connected address controls the private key.
      let signature: string;
      try {
        signature = await signMessageAsync({ message: challengePayload.message });
      } catch (signErr) {
        const rejected =
          signErr instanceof Error &&
          /rejected|denied|user rejected/i.test(signErr.message);
        throw new Error(
          rejected
            ? "Signature request was rejected. Approve it in your wallet to duel."
            : "Could not get a wallet signature. Try again.",
        );
      }

      // 3. Submit the signed proof to actually start the duel and burn energy.
      const res = await fetch("/api/start-duel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerAddress: address, signature }),
      });

      const payload = await res.json();

      if (!res.ok) {
        if (payload.error === "no_energy") {
          throw new Error("Out of energy. Wait for recharge or top up.");
        }
        if (payload.error === "challenge_expired") {
          throw new Error("That signature request timed out. Tap Begin Duel to try again.");
        }
        if (payload.error === "bad_signature") {
          throw new Error("Signature didn't match your wallet. Try again.");
        }
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }

      setDuelId(payload.duelId);
      setHand(payload.hand);
      setAiHintType(payload.aiHintType ?? null); // server-generated hint for turn 1
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
  }, [address, signMessageAsync]);

  // aiHintType is set from the server response: start-duel seeds turn 1,
  // ai-move returns nextAiHintType for subsequent turns. Nothing is client-generated.

  // Reconciles local state against the server's authoritative session after
  // an ambiguous failure — a client-side timeout doesn't mean the serverless
  // function actually failed; it may well have completed and saved the turn
  // after the browser gave up waiting. Returns true if it found and adopted
  // a newer state than what the client already had.
  const resyncFromServer = useCallback(async (): Promise<boolean> => {
    if (!duelId || !address) return false;
    try {
      const res = await fetch(
        `/api/duel-state?duelId=${encodeURIComponent(duelId)}&address=${encodeURIComponent(address)}`,
      );
      if (!res.ok) return false;
      const data = await res.json();

      const synced: GameState = {
        playerHp: data.playerHp,
        aiHp: data.aiHp,
        turn: data.turn,
        isOver: data.isOver,
        playerWon: data.playerWon,
        turns: data.turns ?? [],
      };

      setGameState(synced);
      gameStateRef.current = synced;
      setUsedCardIds(new Set<string>(data.usedCardIds ?? []));
      return true;
    } catch (err) {
      console.error("resyncFromServer failed:", err);
      return false;
    }
  }, [duelId, address]);

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
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25_000);

        const res = await fetch("/api/ai-move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            duelId,
            playerCard,
            // Note: aiHintType, history, and recentDuels are intentionally
            // omitted — the server ignores all of them. The hint is stored
            // on the session; stats come from playerStore.
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
        // Advance the hint to what the server rolled for the NEXT turn.
        if (data.nextAiHintType) setAiHintType(data.nextAiHintType as string);

        await new Promise((r) => setTimeout(r, 1200));

        const patch = data.state as ApiPublicState;
        
        // Calculate intermediate HP after raw damage is applied, before healing heals it back
        const prevHp = gameStateRef.current;
        const playerDamage = patch.lastTurn ? patch.lastTurn.aiDamageDealt : 0;
        const aiDamage = patch.lastTurn ? patch.lastTurn.playerDamageDealt : 0;

        const playerHpAfterDamage = Math.max(0, prevHp.playerHp - playerDamage);
        const aiHpAfterDamage = Math.max(0, prevHp.aiHp - aiDamage);

        // Effective lifesteal is whatever HP the server's final value recovers
        // beyond the damage-only floor — derived rather than re-implementing
        // the drain formula, so it can't drift from server rules and it
        // reflects the 100 HP cap.
        const playerHeal = Math.max(0, patch.playerHp - playerHpAfterDamage);
        const aiHeal = Math.max(0, patch.aiHp - aiHpAfterDamage);

        // Stage 1: Apply damage reduction visual immediately
        setVisualHp({
          player: playerHpAfterDamage,
          ai: aiHpAfterDamage,
        });

        if (patch.lastTurn) {
          setLastDamageFlash({
            player: playerDamage,
            ai: aiDamage,
          });
        }

        // Wait for damage flash to play out
        await new Promise((r) => setTimeout(r, 1000));
        setLastDamageFlash(null);

        // Stage 2: If there's lifesteal, trigger heal flash and transition to final HP values
        if (playerHeal > 0 || aiHeal > 0) {
          setHealFlash({
            player: playerHeal,
            ai: aiHeal,
          });
          
          setVisualHp({
            player: patch.playerHp,
            ai: patch.aiHp,
          });

          await new Promise((r) => setTimeout(r, 1000));
          setHealFlash(null);
        }

        // Stage 3: Fully commit the true game state now that visual sequences completed
        const nextSnap = mergeFromApi(gameStateRef.current, patch);
        setGameState(nextSnap);
        gameStateRef.current = nextSnap;
        setVisualHp(null);

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

        const errorCode = err instanceof Error ? err.message : "";

        // Session-fatal errors: the duel is unrecoverable server-side.
        // Reset to draw phase so the player can start a fresh duel cleanly.
        const isFatal =
          errorCode === "unknown_or_expired_duel" ||
          errorCode === "duel_already_complete" ||
          errorCode === "illegal_card_for_session";

        if (isFatal) {
          setDuelId(null);
          setHand([]);
          setUsedCardIds(new Set());
          setGameState(initGameState());
          setTurnError(
            errorCode === "unknown_or_expired_duel"
              ? "Duel session expired — start a new duel."
              : errorCode === "duel_already_complete"
              ? "This duel has already ended. Start a new one."
              : "Invalid move detected. Duel reset.",
          );
          setPhase("draw");
          return;
        }

        const isAbort = err instanceof DOMException && err.name === "AbortError";
        const isAmbiguous = isAbort || errorCode === "card_already_used";

        if (isAmbiguous) {
          const synced = await resyncFromServer();
          if (synced) {
            setAiCard(null);
            setAiReasoning("");
            setSelectedCard(null);

            if (gameStateRef.current.isOver) {
              if (gameStateRef.current.playerWon) {
                onWin?.(duelId);
              }
              setPhase("done");
            } else {
              setTurnError("Your last move had already gone through — synced up.");
              setPhase("pick");
              setTimeout(() => setTurnError(null), 3000);
            }
            return;
          }
          // Resync itself failed — fall through to the generic messaging below
          // so the player at least gets a retry prompt instead of silence.
        }

        const msg =
          isAbort
            ? "CIPHER took too long to respond. Tap your card again."
            : errorCode === "rate_limit_exceeded"
            ? "Too many moves — slow down and try again."
            : errorCode === "card_already_used"
            ? "That card was already played this duel."
            : errorCode === "missing_duel_session"
            ? "Session missing. Please start a new duel."
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
    [usedCardIds, duelId, resyncFromServer],
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
    perfectDuelToast,
    lastDamageFlash,
    visualHp,
    healFlash,
    beginDuel,
    playTurn,
  };
}
