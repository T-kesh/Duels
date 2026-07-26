import { describe, it, expect } from "vitest";
import { detectCombo, getCombosForCard, COMBO_DEFINITIONS } from "./combos";
import type { Card } from "@/constants/cards";

// ── Test card factories ─────────────────────────────────────────────────────
function makeCard(overrides: Partial<Card> & { id: string }): Card {
  return {
    name: overrides.id,
    type: overrides.type ?? "attack",
    tier: overrides.tier ?? 1,
    damage: overrides.damage ?? 20,
    shield: overrides.shield ?? 0,
    description: "",
    emoji: "⚔️",
    ...overrides,
  };
}

const strike = makeCard({ id: "strike", type: "attack", damage: 30, shield: 8 });
const surge = makeCard({ id: "surge", type: "special", damage: 50, shield: 0 });
const block = makeCard({ id: "block", type: "defend", damage: 0, shield: 40 });
const parry = makeCard({ id: "parry", type: "defend", damage: 10, shield: 30 });
const drain = makeCard({ id: "drain", type: "special", damage: 25, shield: 0 });
const counter = makeCard({ id: "counter", type: "special", damage: 20, shield: 20 });

// Tiered variants
const strikeT2 = makeCard({ id: "strike_t2", type: "attack", damage: 35, shield: 10, tier: 2 });
const surgeT3 = makeCard({ id: "surge_t3", type: "special", damage: 65, shield: 0, tier: 3 });
const blockT2 = makeCard({ id: "block_t2", type: "defend", damage: 0, shield: 50, tier: 2 });
const parryT3 = makeCard({ id: "parry_t3", type: "defend", damage: 15, shield: 40, tier: 3 });
const drainT2 = makeCard({ id: "drain_t2", type: "special", damage: 30, shield: 0, tier: 2 });

describe("detectCombo", () => {
  // ── Rush Combo (Strike → Surge) ─────────────────────────────────────────
  it("detects Rush combo: Strike → Surge", () => {
    const combo = detectCombo(strike, surge);
    expect(combo).not.toBeNull();
    expect(combo!.name).toBe("Rush");
    expect(combo!.bonusDamagePercent).toBe(0.15);
  });

  it("detects Rush combo with tiered variants: Strike_t2 → Surge_t3", () => {
    const combo = detectCombo(strikeT2, surgeT3);
    expect(combo).not.toBeNull();
    expect(combo!.name).toBe("Rush");
  });

  it("does NOT trigger Rush in reverse: Surge → Strike", () => {
    expect(detectCombo(surge, strike)).toBeNull();
  });

  // ── Fortress Combo (Block → Parry) ──────────────────────────────────────
  it("detects Fortress combo: Block → Parry", () => {
    const combo = detectCombo(block, parry);
    expect(combo).not.toBeNull();
    expect(combo!.name).toBe("Fortress");
    expect(combo!.bonusShield).toBe(10);
  });

  it("detects Fortress combo with tiered variants: Block_t2 → Parry_t3", () => {
    const combo = detectCombo(blockT2, parryT3);
    expect(combo).not.toBeNull();
    expect(combo!.name).toBe("Fortress");
  });

  it("does NOT trigger Fortress in reverse: Parry → Block", () => {
    expect(detectCombo(parry, block)).toBeNull();
  });

  // ── Vampiric Rush (any attack → Drain) ──────────────────────────────────
  it("detects Vampiric Rush: Strike → Drain", () => {
    const combo = detectCombo(strike, drain);
    expect(combo).not.toBeNull();
    expect(combo!.name).toBe("Vampiric Rush");
    expect(combo!.bonusHealOverride).toBe(0.75);
  });

  it("detects Vampiric Rush with tiered variants: Strike_t2 → Drain_t2", () => {
    const combo = detectCombo(strikeT2, drainT2);
    expect(combo).not.toBeNull();
    expect(combo!.name).toBe("Vampiric Rush");
  });

  it("does NOT trigger Vampiric Rush from non-attack: Block → Drain", () => {
    // Block is type "defend", not "attack"
    expect(detectCombo(block, drain)).toBeNull();
  });

  it("does NOT trigger Vampiric Rush from special: Surge → Drain", () => {
    // Surge is type "special", not "attack"
    expect(detectCombo(surge, drain)).toBeNull();
  });

  // ── Non-combo sequences ─────────────────────────────────────────────────
  it("returns null for non-combo: Strike → Block", () => {
    expect(detectCombo(strike, block)).toBeNull();
  });

  it("returns null for non-combo: Counter → Parry", () => {
    expect(detectCombo(counter, parry)).toBeNull();
  });

  it("returns null for same card twice: Strike → Strike", () => {
    expect(detectCombo(strike, strike)).toBeNull();
  });

  it("returns null for Block → Block", () => {
    expect(detectCombo(block, block)).toBeNull();
  });
});

describe("getCombosForCard", () => {
  it("returns Rush for strike (as trigger)", () => {
    const combos = getCombosForCard("strike");
    expect(combos.some((c) => c.name === "Rush")).toBe(true);
  });

  it("returns Rush for surge (as finisher)", () => {
    const combos = getCombosForCard("surge");
    expect(combos.some((c) => c.name === "Rush")).toBe(true);
  });

  it("returns Fortress for block (as trigger)", () => {
    const combos = getCombosForCard("block");
    expect(combos.some((c) => c.name === "Fortress")).toBe(true);
  });

  it("returns Vampiric Rush for drain (as finisher)", () => {
    const combos = getCombosForCard("drain");
    expect(combos.some((c) => c.name === "Vampiric Rush")).toBe(true);
  });

  it("handles tiered card IDs", () => {
    const combos = getCombosForCard("strike_t3");
    expect(combos.some((c) => c.name === "Rush")).toBe(true);
  });

  it("returns empty for counter (no combos)", () => {
    const combos = getCombosForCard("counter");
    expect(combos.length).toBe(0);
  });
});

describe("COMBO_DEFINITIONS", () => {
  it("has exactly 3 combos", () => {
    expect(COMBO_DEFINITIONS).toHaveLength(3);
  });

  it("each combo has required fields", () => {
    for (const combo of COMBO_DEFINITIONS) {
      expect(combo.name).toBeTruthy();
      expect(combo.emoji).toBeTruthy();
      expect(combo.finisherCardId).toBeTruthy();
      expect(combo.description).toBeTruthy();
      expect(typeof combo.bonusDamagePercent).toBe("number");
      expect(typeof combo.bonusShield).toBe("number");
      expect(typeof combo.bonusHealOverride).toBe("number");
    }
  });
});
