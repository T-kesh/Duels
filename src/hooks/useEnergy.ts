"use client";

import { useState, useEffect, useCallback } from "react";

const MAX_LIVES = 5;
const RECHARGE_TIME_MS = 4 * 60 * 60 * 1000; // 4 hours
const BONUS_KEY = "duel_bonus_lives";

function readBonus(): number {
  if (typeof window === "undefined") return 0;
  const parsed = parseInt(localStorage.getItem(BONUS_KEY) ?? "0", 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function useEnergy() {
  const [lives, setLives] = useState<number>(MAX_LIVES);
  const [bonusLives, setBonusLives] = useState(0);
  const [nextRechargeAt, setNextRechargeAt] = useState<number | null>(null);

  const syncBonusFromStorage = useCallback(() => {
    setBonusLives(readBonus());
  }, []);

  const calculateLives = useCallback(() => {
    const storedLives = parseInt(localStorage.getItem("duel_lives") ?? MAX_LIVES.toString(), 10);
    const lastRecharge = parseInt(
      localStorage.getItem("duel_last_recharge") ?? `${Date.now()}`,
      10,
    );

    if (storedLives >= MAX_LIVES) {
      setLives(MAX_LIVES);
      setNextRechargeAt(null);
    } else {
      const now = Date.now();
      const elapsed = now - lastRecharge;
      const gainedLives = Math.floor(elapsed / RECHARGE_TIME_MS);

      const newLives = Math.min(MAX_LIVES, storedLives + gainedLives);
      setLives(newLives);

      if (newLives < MAX_LIVES) {
        const remaining = RECHARGE_TIME_MS - (elapsed % RECHARGE_TIME_MS);
        setNextRechargeAt(now + remaining);
      } else {
        setNextRechargeAt(null);
        localStorage.setItem("duel_last_recharge", now.toString());
      }

      localStorage.setItem("duel_lives", newLives.toString());
    }

    syncBonusFromStorage();
  }, [syncBonusFromStorage]);

  useEffect(() => {
    calculateLives();
    const interval = setInterval(calculateLives, 60000);

    const onStorage = () => calculateLives();
    const onBonus = () => syncBonusFromStorage();

    window.addEventListener("storage", onStorage);
    window.addEventListener("energy-bonus-update", onBonus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("energy-bonus-update", onBonus);
    };
  }, [calculateLives, syncBonusFromStorage]);

  const totalPlaysRemaining = bonusLives + lives;

  const useLife = useCallback(() => {
    if (totalPlaysRemaining <= 0) return false;

    if (bonusLives > 0) {
      const nextBonus = bonusLives - 1;
      setBonusLives(nextBonus);
      localStorage.setItem(BONUS_KEY, nextBonus.toString());
      window.dispatchEvent(new Event("energy-bonus-update"));
      return true;
    }

    if (lives <= 0) return false;

    const newLives = lives - 1;
    setLives(newLives);
    localStorage.setItem("duel_lives", newLives.toString());

    if (lives === MAX_LIVES) {
      localStorage.setItem("duel_last_recharge", Date.now().toString());
    }

    return true;
  }, [bonusLives, lives, totalPlaysRemaining]);

  return {
    lives,
    bonusLives,
    totalPlaysRemaining,
    nextRechargeAt,
    useLife,
    refreshBonusMeta: syncBonusFromStorage,
    MAX_LIVES,
  };
}
