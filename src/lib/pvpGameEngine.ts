import { Card, STARTING_HP } from "@/constants/cards";
import { calcDamageDealt, CLUTCH_DAMAGE_MULTIPLIER } from "@/lib/gameEngine";

/**
 * Symmetric two-player duel resolution. Unlike the vs-AI engine, neither side
 * gets a hint shield, and ties are NOT silently awarded to one side — the
 * approved rule is: higher HP wins, then higher cumulative damage, then
 * sudden-death rounds, with the challenger (player2) as the final fallback.
 *
 * Pure and deterministic: the route layer draws cards (crypto RNG) and feeds
 * them in; this module only computes outcomes so it can be unit-tested and
 * replayed for claim verification.
 */

export type PvpSlot = "p1" | "p2";

/** Standard duel length before any sudden-death extension. */
export const PVP_BASE_ROUNDS = 3;
/** Safety cap on sudden-death rounds before falling back to the challenger. */
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
  winnerSlot: PvpSlot | null;
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

  let p1DamageDealt = calcDamageDealt(p1Card.damage, p2Card.shield);
  let p2DamageDealt = calcDamageDealt(p2Card.damage, p1Card.shield);
  if (clutch) {
    p1DamageDealt = Math.floor(p1DamageDealt * CLUTCH_DAMAGE_MULTIPLIER);
    p2DamageDealt = Math.floor(p2DamageDealt * CLUTCH_DAMAGE_MULTIPLIER);
  }

  const p1Hp = Math.max(0, state.p1Hp - p2DamageDealt);
  const p2Hp = Math.max(0, state.p2Hp - p1DamageDealt);
  const p1DamageTotal = state.p1DamageTotal + p1DamageDealt;
  const p2DamageTotal = state.p2DamageTotal + p2DamageDealt;

  const p1Dead = p1Hp <= 0;
  const p2Dead = p2Hp <= 0;

  let isOver = false;
  let winnerSlot: PvpSlot | null = null;

  if (p1Dead && p2Dead) {
    // Double KO — cannot continue to sudden death with no HP. Decide by total
    // damage; an exact tie falls to the challenger (p2).
    isOver = true;
    winnerSlot = p1DamageTotal > p2DamageTotal ? "p1" : "p2";
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
      // Exhausted sudden-death cap with a perfect tie — challenger wins.
      isOver = true;
      winnerSlot = "p2";
    }
    // else: dead even — fall through to another (sudden-death) round.
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
