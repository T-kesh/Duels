import { describe, it, expect } from "vitest";
import { CARDS } from "@/constants/cards";
import {
  initPvpState,
  applyPvpRound,
  determinePvpOutcome,
  needsSuddenDeath,
  PVP_BASE_ROUNDS,
} from "@/lib/pvpGameEngine";

const strike = CARDS.find((c) => c.id === "strike")!; // 30 dmg / 8 shield
const block = CARDS.find((c) => c.id === "block")!; //  0 dmg / 40 shield
const surge = CARDS.find((c) => c.id === "surge")!; // 50 dmg / 0 shield
const drain = CARDS.find((c) => c.id === "drain")!; // 20 dmg / 0 shield

describe("pvpGameEngine", () => {
  it("applies symmetric damage minus shield", () => {
    const next = applyPvpRound(initPvpState(), strike, strike); // strike vs strike -> damage dealt is max(0, 30-8) = 22. Both take 22.
    expect(next.p1Hp).toBe(78);
    expect(next.p2Hp).toBe(78);
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
    // strike 30 -> floor(30*1.1)=33 vs block 40 shield => max(0, 33-40)=0 dmg
    expect(after.rounds[2].p1DamageDealt).toBe(0);
    
    const clutch = applyPvpRound(before, surge, strike); // surge(50) vs strike(8 shield)
    // p1: floor(50 * 1.1) - 8 = 55 - 8 = 47. p2: floor(30*1.1) - 0 = 33
    expect(clutch.rounds[2].p1DamageDealt).toBe(47);
    expect(clutch.rounds[2].p2DamageDealt).toBe(33);
  });

  it("applies lifesteal healing in PvP", () => {
    let s = initPvpState();
    s.p1Hp = 50;
    const next = applyPvpRound(s, drain, strike); // drain(20) vs strike(8 shield) -> 12 dmg. heals floor(12 * 0.5) = 6. strike(30) vs drain(0 shield) -> 30 dmg.
    expect(next.p1Hp).toBe(50 - 30 + 6); // 26
  });

  it("ends immediately when a player is reduced to 0 HP", () => {
    let s = initPvpState();
    s = applyPvpRound(s, surge, strike); // p2 takes 50-8=42 -> 58; p1 takes 30-0=30 -> 70
    s = applyPvpRound(s, surge, strike); // p2 takes 50-8=42 -> 16; p1 takes 30-0=30 -> 40
    s = applyPvpRound(s, surge, strike); // p2 takes floor(50*1.1)-8=47 -> 0 -> over
    expect(s.isOver).toBe(true);
    expect(s.winnerSlot).toBe("p1");
  });

  it("after base rounds, higher HP wins", () => {
    let s = initPvpState();
    s = applyPvpRound(s, strike, block);
    s = applyPvpRound(s, strike, block);
    s = applyPvpRound(s, strike, block);
    expect(s.isOver).toBe(false); // HP equal, damage equal -> sudden death
    expect(needsSuddenDeath(s)).toBe(true);
  });

  it("ends in a draw when sudden-death cap is reached with perfect tie", () => {
    let s = initPvpState();
    s = applyPvpRound(s, block, block); // r1
    s = applyPvpRound(s, block, block); // r2
    s = applyPvpRound(s, block, block); // r3 -> HP 100-100, damage 0-0 -> sudden death r4
    s = applyPvpRound(s, block, block); // r4
    s = applyPvpRound(s, block, block); // r5
    s = applyPvpRound(s, block, block); // r6
    s = applyPvpRound(s, block, block); // r7
    s = applyPvpRound(s, block, block); // r8 (last sudden-death round)
    expect(s.isOver).toBe(true);
    expect(s.winnerSlot).toBeNull(); // draw game
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

  it("decides a double-KO by total damage, or Null/draw if equal", () => {
    let s = initPvpState();
    s = applyPvpRound(s, surge, surge);
    const dk = applyPvpRound(s, surge, surge);
    expect(dk.isOver).toBe(true);
    expect(dk.winnerSlot).toBeNull(); // symmetric double KO -> draw
  });
});
