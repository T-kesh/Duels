import { describe, it, expect } from "vitest";
import { CARDS } from "@/constants/cards";
import {
  initGameState,
  resolveTurn,
  previewDamage,
  HINT_SHIELD_BONUS,
} from "@/lib/gameEngine";

const strike = CARDS.find((c) => c.id === "strike")!;
const block = CARDS.find((c) => c.id === "block")!;
const surge = CARDS.find((c) => c.id === "surge")!;

describe("gameEngine", () => {
  it("applies damage minus shield", () => {
    const state = initGameState();
    const next = resolveTurn(state, surge, block);
    expect(next.playerHp).toBe(100);
    expect(next.aiHp).toBe(90);
  });

  it("grants AI hint shield when type matches hint", () => {
    const state = initGameState();
    const withHint = resolveTurn(state, surge, block, "defend");
    const withoutHint = resolveTurn(state, surge, block, "attack");
    expect(withHint.aiHp).toBeGreaterThan(withoutHint.aiHp);
    expect(withHint.aiHp - withoutHint.aiHp).toBe(HINT_SHIELD_BONUS);
  });

  it("clutch turn deals more damage on turn 3", () => {
    let state = initGameState();
    state = resolveTurn(state, strike, strike);
    state = resolveTurn(state, strike, strike);
    expect(state.turn).toBe(3);

    const clutch = resolveTurn(state, surge, block);
    const nonClutch = resolveTurn(initGameState(), surge, block);
    expect(clutch.aiHp).toBeLessThan(nonClutch.aiHp);
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
