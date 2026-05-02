"use client";

import { useState, useEffect, useCallback } from "react";

const MAX_LIVES = 5;
const RECHARGE_TIME_MS = 4 * 60 * 60 * 1000; // 4 hours

export function useEnergy() {
  const [lives, setLives] = useState<number>(MAX_LIVES);
  const [nextRechargeAt, setNextRechargeAt] = useState<number | null>(null);

  const calculateLives = useCallback(() => {
    const storedLives = parseInt(localStorage.getItem("duel_lives") ?? MAX_LIVES.toString());
    const lastRecharge = parseInt(localStorage.getItem("duel_last_recharge") ?? Date.now().toString());
    
    if (storedLives >= MAX_LIVES) {
      setLives(MAX_LIVES);
      setNextRechargeAt(null);
      return;
    }

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
  }, []);

  useEffect(() => {
    calculateLives();
    const interval = setInterval(calculateLives, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [calculateLives]);

  const useLife = useCallback(() => {
    if (lives <= 0) return false;
    
    const newLives = lives - 1;
    setLives(newLives);
    localStorage.setItem("duel_lives", newLives.toString());
    
    if (lives === MAX_LIVES) {
      localStorage.setItem("duel_last_recharge", Date.now().toString());
    }
    
    return true;
  }, [lives]);

  return { lives, nextRechargeAt, useLife, MAX_LIVES };
}
