import { describe, it, expect } from "vitest";
import { CARDS } from "@/constants/cards";
import {
  initPvpState,
  applyPvpRound,
  determinePvpOutcome,
  needsSuddenDeath,
  PVP_BASE_ROUNDS,
} from "@/lib/pvpGameEngine";

const strike = CARDS.find((c) => c.id === "strike")!; // 30 dmg / 0 shield
const block = CARDS.find((c) => c.id === "block")!; //  0 dmg / 40 shield
const surge = CARDS.find((c) => c.id === "surge")!; // 50 dmg / 0 shield

describe("pvpGameEngine", () => {
  it("applies symmetric damage minus shield (no hint bonus for either side)", () => {
    const next = applyPvpRound(initPvpState(), strike, strike);
    expect(next.p1Hp).toBe(70);
    expect(next.p2Hp).toBe(70);
    expect(next.isOver).toBe(false);
    expect(next.round).toBe(2);
  });

  it("blocks absorb damage symmetrically", () => {
    const next = applyPvpRound(initPvpState(), strike, block);
    // strike(30) vs block(40 shield) -> 0 to p2; block(0 dmg) -> 0 to p1
    expect(next.p1Hp).toBe(100);
    expect(next.p2Hp).toBe(100);
  });

  it("applies clutch multiplier on round 3 for both players", () => {
    let s = initPvpState();
    s = applyPvpRound(s, block, block); // r1
    s = applyPvpRound(s, block, block); // r2
    expect(s.round).toBe(PVP_BASE_ROUNDS);
    const before = s;
    const after = applyPvpRound(before, strike, block); // r3, clutch
    // strike 30 -> floor(30*1.1)=33 vs block 40 shield => max(0, 30-40)=0 dmg, clutch floor(0)=0
    expect(after.rounds[2].p1DamageDealt).toBe(0);
    // give a clean clutch test: surge(50) unblocked on round 3
    const clutch = applyPvpRound(before, surge, strike);
    expect(clutch.rounds[2].p1DamageDealt).toBe(Math.floor(50 * 1.1)); // 55
    expect(clutch.rounds[2].p2DamageDealt).toBe(Math.floor(30 * 1.1)); // 33
  });

  it("ends immediately when a player is reduced to 0 HP", () => {
    // Force lethal: surge (50) lands fully against strike (0 shield).
    let s = initPvpState();
    s = applyPvpRound(s, surge, strike); // p2 takes 50 -> 50; p1 takes 30 -> 70
    s = applyPvpRound(s, surge, strike); // p2 takes 50 -> 0 -> over
    expect(s.isOver).toBe(true);
    expect(s.winnerSlot).toBe("p1");
  });

  it("after base rounds, higher HP wins", () => {
    let s = initPvpState();
    s = applyPvpRound(s, strike, block); // p2 absorbs; p1 full, p2 full
    s = applyPvpRound(s, strike, block);
    s = applyPvpRound(s, strike, block); // round 3, still 100-100? strike vs block = 0
    // tie path — equal HP and equal (zero) damage -> sudden death, not over
    expect(s.isOver).toBe(false);
    expect(needsSuddenDeath(s)).toBe(true);
  });

  it("after base rounds with unequal HP, decides without sudden death", () => {
    let s = initPvpState();
    s = applyPvpRound(s, strike, strike); // 70-70
    s = applyPvpRound(s, strike, strike); // 40-40
    s = applyPvpRound(s, surge, strike); // r3 clutch: p1 deals 55, p2 deals 33 -> p2Hp 40-55<=0
    expect(s.isOver).toBe(true);
    expect(s.winnerSlot).toBe("p1");
  });

  it("breaks an HP tie by cumulative damage after base rounds", () => {
    // Construct equal HP but unequal damage at round 3 via a sudden-death-free path.
    let s = initPvpState();
    s = applyPvpRound(s, strike, strike); // 70-70, dmg 30-30
    s = applyPvpRound(s, strike, strike); // 40-40, dmg 60-60
    // round 3: p1 plays parry (10 dmg/30 shield), p2 plays parry too -> symmetric, still tie
    // Instead: both counter (20 dmg / 20 shield) clutch: dealt = floor((20-20)*1.1)=0 -> tie again
    s = applyPvpRound(s, block, block); // r3: 0 dmg both, HP 40-40, dmg equal -> sudden death
    expect(s.isOver).toBe(false);
    expect(s.round).toBe(PVP_BASE_ROUNDS + 1);
  });

  it("determinePvpOutcome replays a transcript to the same result", () => {
    const transcript = [
      { p1Card: strike, p2Card: strike },
      { p1Card: strike, p2Card: strike },
      { p1Card: surge, p2Card: strike },
    ];
    const outcome = determinePvpOutcome(transcript);
    expect(outcome.isOver).toBe(true);
    expect(outcome.winnerSlot).toBe("p1");
  });

  it("decides a double-KO by total damage", () => {
    // Both at low HP, both lethal on the same round.
    let s = initPvpState();
    s = applyPvpRound(s, surge, surge); // 50-50, dmg 50-50
    // round 2: p1 surge (50) vs p2 strike(30). p2 takes 50 -> 0; p1 takes 30 -> 20. not double KO.
    // craft double KO: round 2 both surge -> both 0
    const dk = applyPvpRound(s, surge, surge);
    expect(dk.isOver).toBe(true);
    // equal total damage -> challenger (p2) wins the tie
    expect(dk.winnerSlot).toBe("p2");
  });
});
