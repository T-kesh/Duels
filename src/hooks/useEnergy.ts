"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";

export const MAX_LIVES = 5;

export function useEnergy() {
  const { address } = useAccount();
  const [lives, setLives] = useState<number>(MAX_LIVES);
  const [bonusLives, setBonusLives] = useState(0);
  const [nextRechargeAt, setNextRechargeAt] = useState<number | null>(null);
  const [totalWins, setTotalWins] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchState = useCallback(async () => {
    if (!address) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/player-state?${new URLSearchParams({ address })}`);
      if (!res.ok) return;

      const data = await res.json();
      setLives(data.lives ?? MAX_LIVES);
      setBonusLives(data.bonusLives ?? 0);
      setNextRechargeAt(data.nextRechargeAt ?? null);
      setTotalWins(data.totalWins ?? 0);

      if (typeof data.totalWins === "number") {
        localStorage.setItem("duel_total_wins", String(data.totalWins));
      }
    } catch (e) {
      console.error("player-state fetch", e);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 60_000);
    const onUpdate = () => fetchState();

    window.addEventListener("player-state-update", onUpdate);
    window.addEventListener("energy-bonus-update", onUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener("player-state-update", onUpdate);
      window.removeEventListener("energy-bonus-update", onUpdate);
    };
  }, [fetchState]);

  const totalPlaysRemaining = bonusLives + lives;

  const useLife = useCallback(() => {
    if (totalPlaysRemaining <= 0) return false;
    return true;
  }, [totalPlaysRemaining]);

  return {
    lives,
    bonusLives,
    totalPlaysRemaining,
    nextRechargeAt,
    totalWins,
    loading,
    useLife,
    refresh: fetchState,
    MAX_LIVES,
  };
}
