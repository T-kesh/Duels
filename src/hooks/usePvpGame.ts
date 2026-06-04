"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAccount, useSignMessage } from "wagmi";
import type { Card } from "@/constants/cards";

/** Mirror of the server `PvpPublicView` (kept local to avoid importing server-only modules). */
export interface PvpView {
  duelId: string;
  yourSlot: "p1" | "p2";
  yourHand: Card[];
  usedCardIds: string[];
  round: number;
  isOver: boolean;
  youWon: boolean | null;
  yourHp: number;
  opponentHp: number;
  youSubmitted: boolean;
  opponentSubmitted: boolean;
  roundDeadlineMs: number;
  lastRound: {
    round: number;
    yourCard: Card;
    opponentCard: Card;
    yourDamageDealt: number;
    opponentDamageDealt: number;
    yourHpAfter: number;
    opponentHpAfter: number;
    sudden: boolean;
  } | null;
}

type PvpPhase = "idle" | "authenticating" | "playing" | "done";

const JSON_HEADERS = { "Content-Type": "application/json" };

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "pvp_error";
}

export function usePvpGame(duelId: string | null) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [phase, setPhase] = useState<PvpPhase>("idle");
  const [view, setView] = useState<PvpView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tokenRef = useRef<string | null>(null);

  const applyState = useCallback((state: PvpView) => {
    setView(state);
    if (state.isOver) setPhase("done");
  }, []);

  const authenticate = useCallback(async () => {
    if (!address || !duelId) return;
    setError(null);
    setBusy(true);
    setPhase("authenticating");
    try {
      const ch = await fetch("/api/pvp/auth/challenge", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ duelId, address }),
      });
      const chData = await ch.json();
      if (!ch.ok) throw new Error(chData.error ?? "challenge_failed");

      const signature = await signMessageAsync({ message: chData.message as string });

      const vr = await fetch("/api/pvp/auth/verify", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ duelId, address, signature }),
      });
      const vrData = await vr.json();
      if (!vr.ok) throw new Error(vrData.error ?? "verify_failed");

      tokenRef.current = vrData.token;
      applyState(vrData.state as PvpView);
      if (!(vrData.state as PvpView).isOver) setPhase("playing");
    } catch (e) {
      setError(errMessage(e));
      setPhase("idle");
    } finally {
      setBusy(false);
    }
  }, [address, duelId, signMessageAsync, applyState]);

  const refresh = useCallback(async () => {
    if (!address || !duelId || !tokenRef.current) return;
    try {
      const qs = new URLSearchParams({ duelId, address, token: tokenRef.current });
      const res = await fetch(`/api/pvp/state?${qs.toString()}`);
      const data = await res.json();
      if (res.ok && data.state) applyState(data.state as PvpView);
    } catch {
      /* transient — next poll retries */
    }
  }, [address, duelId, applyState]);

  // Poll for the opponent's move / round resolution while playing.
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(refresh, 2500);
    return () => clearInterval(id);
  }, [phase, refresh]);

  const submitCard = useCallback(
    async (cardId: string) => {
      if (!address || !duelId || !tokenRef.current || busy) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/pvp/move", {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ duelId, address, token: tokenRef.current, cardId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "move_failed");
        applyState(data.state as PvpView);
      } catch (e) {
        setError(errMessage(e));
      } finally {
        setBusy(false);
      }
    },
    [address, duelId, busy, applyState],
  );

  const claimForfeit = useCallback(async () => {
    if (!address || !duelId || !tokenRef.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pvp/forfeit", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ duelId, address, token: tokenRef.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "forfeit_failed");
      applyState(data.state as PvpView);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }, [address, duelId, busy, applyState]);

  return { phase, view, error, busy, authenticate, submitCard, claimForfeit, refresh };
}
