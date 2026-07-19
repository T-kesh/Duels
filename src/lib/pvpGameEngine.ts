import { Card, STARTING_HP } from "@/constants/cards";
import { calcDamageDealtUnified } from "@/lib/combat";

/**
 * Symmetric two-player duel resolution. Neither side
 * gets a hint shield, and ties are resolved via split pot in rewards payout.
 * Pure and deterministic calculation.
 */

export type PvpSlot = "p1" | "p2";

/** Standard duel length before any sudden-death extension. */
export const PVP_BASE_ROUNDS = 3;
/** Safety cap on sudden-death rounds before falling back to a tie. */
export const PVP_MAX_SUDDEN_DEATH = 5;

export interface PvpRoundInput {
  round: number; // 1-based
  p1Card: Card;
  p2Card: Card;
  sudden?: boolean;
}

export interface PvpResolvedRound extends PvpRoundInput {
  p1DamageDealt: number;
  p2DamageDealt: number;
  p1HpAfter: number;
  p2HpAfter: number;
}

export interface PvpState {
  p1Hp: number;
  p2Hp: number;
  p1DamageTotal: number;
  p2DamageTotal: number;
  /** Next round to be played (1-based). */
  round: number;
  rounds: PvpResolvedRound[];
  isOver: boolean;
  winnerSlot: PvpSlot | null; // null represents a draw/tie
}

export function initPvpState(): PvpState {
  return {
    p1Hp: STARTING_HP,
    p2Hp: STARTING_HP,
    p1DamageTotal: 0,
    p2DamageTotal: 0,
    round: 1,
    rounds: [],
    isOver: false,
    winnerSlot: null,
  };
}

/** Round 3 and every sudden-death round are high-stakes "clutch" rounds. */
function isClutchRound(round: number): boolean {
  return round >= PVP_BASE_ROUNDS;
}

/**
 * Apply one round of two simultaneously-revealed cards. Returns a new state;
 * does nothing if the duel is already over.
 */
export function applyPvpRound(state: PvpState, p1Card: Card, p2Card: Card): PvpState {
  if (state.isOver) return state;

  const round = state.round;
  const clutch = isClutchRound(round);

  const p1DamageDealt = calcDamageDealtUnified(p1Card.damage, p2Card.shield, 0, clutch, p1Card.piercing ?? 0);
  const p2DamageDealt = calcDamageDealtUnified(p2Card.damage, p1Card.shield, 0, clutch, p2Card.piercing ?? 0);

  // Lifesteal calculation (50% of total damage dealt, including pierce)
  const p1Heal = p1Card.id.startsWith("drain") ? Math.floor(p1DamageDealt * 0.5) : 0;
  const p2Heal = p2Card.id.startsWith("drain") ? Math.floor(p2DamageDealt * 0.5) : 0;

  // Apply damage and healing (capped at starting HP)
  const p1Hp = Math.min(STARTING_HP, Math.max(0, state.p1Hp - p2DamageDealt + p1Heal));
  const p2Hp = Math.min(STARTING_HP, Math.max(0, state.p2Hp - p1DamageDealt + p2Heal));

  const p1DamageTotal = state.p1DamageTotal + p1DamageDealt;
  const p2DamageTotal = state.p2DamageTotal + p2DamageDealt;

  const p1Dead = p1Hp <= 0;
  const p2Dead = p2Hp <= 0;

  let isOver = false;
  let winnerSlot: PvpSlot | null = null;

  if (p1Dead && p2Dead) {
    // Double KO — cannot continue. Equal damage results in a draw (winnerSlot = null).
    isOver = true;
    if (p1DamageTotal !== p2DamageTotal) {
      winnerSlot = p1DamageTotal > p2DamageTotal ? "p1" : "p2";
    }
  } else if (p1Dead || p2Dead) {
    isOver = true;
    winnerSlot = p1Dead ? "p2" : "p1";
  } else if (round >= PVP_BASE_ROUNDS) {
    if (p1Hp !== p2Hp) {
      isOver = true;
      winnerSlot = p1Hp > p2Hp ? "p1" : "p2";
    } else if (p1DamageTotal !== p2DamageTotal) {
      isOver = true;
      winnerSlot = p1DamageTotal > p2DamageTotal ? "p1" : "p2";
    } else if (round >= PVP_BASE_ROUNDS + PVP_MAX_SUDDEN_DEATH) {
      // Sudden-death cap reached with perfect tie — draw game.
      isOver = true;
      winnerSlot = null; // Draw/Split the pot
    }
  }

  const resolved: PvpResolvedRound = {
    round,
    p1Card,
    p2Card,
    sudden: round > PVP_BASE_ROUNDS,
    p1DamageDealt,
    p2DamageDealt,
    p1HpAfter: p1Hp,
    p2HpAfter: p2Hp,
  };

  return {
    p1Hp,
    p2Hp,
    p1DamageTotal,
    p2DamageTotal,
    round: isOver ? round : round + 1,
    rounds: [...state.rounds, resolved],
    isOver,
    winnerSlot,
  };
}

/** True once the base rounds are done and the standings are dead-even (HP + damage). */
export function needsSuddenDeath(state: PvpState): boolean {
  return !state.isOver && state.round > PVP_BASE_ROUNDS;
}

/**
 * Replay an ordered transcript from a fresh state and recompute the outcome.
 * Used by the claim/sign-resolve route as defense-in-depth so the winner is
 * never trusted from stored fields alone.
 */
export function determinePvpOutcome(
  transcript: { p1Card: Card; p2Card: Card }[],
): PvpState {
  let state = initPvpState();
  for (const round of transcript) {
    state = applyPvpRound(state, round.p1Card, round.p2Card);
  }
  return state;
}
