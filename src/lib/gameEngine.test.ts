import { describe, it, expect } from "vitest";
import { CARDS } from "@/constants/cards";
import {
  initGameState,
  resolveTurn,
  previewDamage,
  HINT_SHIELD_BONUS,
} from "@/lib/gameEngine";

const strike = CARDS.find((c) => c.id === "strike")!; // 30 dmg / 8 shield
const block = CARDS.find((c) => c.id === "block")!;
const surge = CARDS.find((c) => c.id === "surge")!;
const drain = CARDS.find((c) => c.id === "drain")!; // 20 dmg / 0 shield

describe("gameEngine", () => {
  it("applies damage minus shield", () => {
    const state = initGameState();
    const next = resolveTurn(state, surge, block);
    expect(next.playerHp).toBe(100); // block deals 0
    expect(next.aiHp).toBe(90); // surge(50) vs block(40 shield) -> 10 damage -> aiHp: 100 - 10 = 90
  });

  it("grants AI hint shield when type matches hint", () => {
    const state = initGameState();
    const withHint = resolveTurn(state, surge, block, "defend");
    const withoutHint = resolveTurn(state, surge, block, "attack");
    expect(withHint.aiHp).toBeGreaterThan(withoutHint.aiHp);
    expect(withHint.aiHp - withoutHint.aiHp).toBe(HINT_SHIELD_BONUS);
  });

  it("clutch turn applies multiplier to base damage first then subtracts shield", () => {
    let state = initGameState();
    state = resolveTurn(state, strike, strike);
    state = resolveTurn(state, strike, strike);
    expect(state.turn).toBe(3);

    const clutch = resolveTurn(state, strike, block); // Turn 3: strike damage * 1.1 = Math.floor(30 * 1.1) = 33. vs block(40 shield) -> 0 damage
    expect(clutch.aiHp).toBe(state.aiHp); // 100% blocked
  });

  it("applies lifesteal on Drain card play", () => {
    const state = initGameState();
    state.playerHp = 50; // set player HP low to measure healing
    // New Drain (25 dmg / 10 pierce / 0 shield) vs Strike (30 dmg / 8 shield):
    //   - Strike shield is 8. Drain damage is 25.
    //   - Total shield is 8. Since piercing (10) > shield (8), all shield is bypassed.
    //   - Total damage dealt = 25.
    //   - Lifesteal: floor(25 * 0.5) = 12.
    //   - Opponent's Strike (30 dmg) vs Drain (0 shield) -> 30 damage.
    //   - Player HP: 50 - 30 + 12 = 32.
    const next = resolveTurn(state, drain, strike);
    expect(next.playerHp).toBe(32);
  });

  it("pierces shields and heals on Drain vs Block matchup", () => {
    const state = initGameState();
    state.playerHp = 50;
    // New Drain (25 dmg / 10 pierce / 0 shield) vs Block (0 dmg / 40 shield):
    //   - Block shield is 40. Drain damage is 25.
    //   - Base damage is max(0, 25 - 40) = 0.
    //   - Pierce damage: min(10, 40) = 10.
    //   - Total damage dealt = 10.
    //   - Lifesteal: floor(10 * 0.5) = 5.
    //   - Player HP: 50 - 0 (Block deals 0) + 5 = 55.
    const next = resolveTurn(state, drain, block);
    expect(next.playerHp).toBe(55);
    expect(next.aiHp).toBe(90); // 100 - 10
  });

  it("previewDamage matches resolve output", () => {
    const dealt = previewDamage(strike, block.shield);
    const state = resolveTurn(initGameState(), strike, block);
    expect(state.turns[0].playerDamageDealt).toBe(dealt);
  });

  it("player wins ties at equal HP", () => {
    let state = initGameState();
    state = resolveTurn(state, block, block);
    state = resolveTurn(state, block, block);
    state = resolveTurn(state, block, block);
    expect(state.isOver).toBe(true);
    expect(state.playerWon).toBe(true);
  });
});

describe("gameEngine combos", () => {
  const parry = CARDS.find((c) => c.id === "parry")!;

  it("never triggers combos on turn 1", () => {
    const state = initGameState();
    const next = resolveTurn(state, surge, block);
    expect(next.turns[0].playerCombo).toBeUndefined();
    expect(next.turns[0].aiCombo).toBeUndefined();
  });

  it("applies Rush combo bonus damage", () => {
    let state = initGameState();
    state = resolveTurn(state, strike, block);
    state = resolveTurn(state, surge, block);
    expect(state.turns[1].playerCombo).toBe("Rush");
    
    // surge damage = 50 * 1.15 = 57.5
    // calcDamageDealtUnified(57.5, 40) => 17.5
    // Base damage without combo would be 50 - 40 = 10
    expect(state.turns[1].playerDamageDealt).toBeGreaterThan(10);
  });

  it("applies Fortress combo bonus shield", () => {
    let state = initGameState();
    state = resolveTurn(state, block, strike);
    state = resolveTurn(state, parry, strike);
    expect(state.turns[1].playerCombo).toBe("Fortress");
    
    // parry has 30 shield. +10 bonus = 40.
    // strike has 30 dmg.
    // 30 dmg vs 40 shield = 0 damage taken.
    expect(state.turns[1].aiDamageDealt).toBe(0);
  });

  it("applies Vampiric Rush combo bonus heal", () => {
    let state = initGameState();
    state.playerHp = 50;
    state = resolveTurn(state, strike, block);
    const hpBeforeDrain = state.playerHp;
    state = resolveTurn(state, drain, block);
    
    expect(state.turns[1].playerCombo).toBe("Vampiric Rush");
    
    // Drain vs block: deals 10 pierce dmg.
    // Normal heal is 50% of 10 = 5.
    // Vampiric rush is 75% of 10 = 7.5 -> Math.floor(7.5) = 7.
    const hpDiff = state.playerHp - hpBeforeDrain;
    expect(hpDiff).toBe(7);
  });
  
  it("CIPHER also triggers combos", () => {
    let state = initGameState();
    state = resolveTurn(state, block, strike);
    state = resolveTurn(state, block, surge);
    expect(state.turns[1].aiCombo).toBe("Rush");
    expect(state.turns[1].aiDamageDealt).toBeGreaterThan(10);
  });
});
