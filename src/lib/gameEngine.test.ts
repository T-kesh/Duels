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
