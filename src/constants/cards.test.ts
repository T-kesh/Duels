import { describe, it, expect } from "vitest";
import { drawHandWithRng } from "@/constants/cards";

describe("cards pool and hand generation", () => {
  it("draws exactly 6 cards with proportional caps when count is 6", () => {
    // Mock random generator that always returns high values to force max epic/rare
    const rng = () => 0.1; // lower than 0.3/0.55 -> should include maximum allowed epic/rare
    
    // Test for a veteran player (totalWins = 100)
    const pool = drawHandWithRng(100, rng, 6);
    expect(pool.length).toBe(6);
    
    // Check that we don't exceed the proportional limits:
    // Max 2 tier-3 (epic) and max 2 tier-2 (rare)
    const epics = pool.filter(c => c.tier === 3);
    const rares = pool.filter(c => c.tier === 2);
    
    expect(epics.length).toBeLessThanOrEqual(2);
    expect(rares.length).toBeLessThanOrEqual(2);
  });
  
  it("draws exactly 3 cards with normal caps when count is 3", () => {
    const rng = () => 0.1;
    const hand = drawHandWithRng(100, rng, 3);
    expect(hand.length).toBe(3);
    
    const epics = hand.filter(c => c.tier === 3);
    const rares = hand.filter(c => c.tier === 2);
    
    expect(epics.length).toBeLessThanOrEqual(1);
    expect(rares.length).toBeLessThanOrEqual(1);
  });
});
