import crypto from "crypto";
import type { Card } from "@/constants/cards";
import type { AiHintType } from "@/lib/gameEngine";

/**
 * CIPHER's card selection engine.
 *
 * The pick is decided entirely server-side: an LLM never chooses the card
 * (so prompt injection can only ever touch flavor text), and the client
 * never influences the hint (it's generated here and stored on the session).
 *
 * Randomization model:
 *  - a "sharpness" factor scaled by the player's win count decides whether
 *    CIPHER plays a scored strategic pick or a uniformly random card. New
 *    players face a looser, more random CIPHER; veterans face sharp play.
 *  - strategic picks are weighted-random over squared scores rather than
 *    argmax, so even sharp play stays unpredictable.
 */

export const HINT_TYPES: AiHintType[] = ["attack", "defend", "special"];

/** How often CIPHER's play matches the hint it showed the player. */
export const HINT_HONOR_RATE = 0.7;

function cryptoRandom(): number {
  return crypto.randomInt(281474976710655) / 281474976710655;
}

export function randomHint(rng: () => number = cryptoRandom): AiHintType {
  return HINT_TYPES[Math.floor(rng() * HINT_TYPES.length)] as AiHintType;
}

/**
 * 0..1 — how strategically CIPHER plays, scaled by the player's lifetime
 * wins. New players (0 wins) get a mostly-random CIPHER; by 15 wins (tier-3
 * unlock) CIPHER plays sharp. This is the difficulty curve: it eases the
 * onboarding your new users feel while tightening the endgame veterans coast
 * through.
 */
export function cipherSharpness(playerWins: number): number {
  const w = Math.max(0, playerWins);
  return Math.min(0.9, 0.35 + (w / 15) * 0.55);
}

interface PickInput {
  /** Full tiered pool CIPHER may play from. */
  pool: Card[];
  playerHp: number;
  aiHp: number;
  /** 1-based turn number; turn 3 is the last. */
  turn: number;
  /** Hint shown to the player for this pick. */
  hintType: AiHintType;
  playerWins: number;
  rng?: () => number;
}

function scoreCard(card: Card, input: PickInput, avgShield: number, avgDamage: number): number {
  const { playerHp, aiHp, turn } = input;

  const expectedDamage = Math.max(0, card.damage - avgShield);
  const expectedBlock = Math.min(card.shield, avgDamage);

  // Weights shift with the game state: protect a low health pool, push
  // damage on the final turn or when the player is close to dead.
  let damageWeight = 1.0;
  let blockWeight = 1.0;
  if (turn >= 3) damageWeight += 0.4;
  if (playerHp <= card.damage) damageWeight += 0.6; // potential lethal
  if (aiHp <= 35) blockWeight += 0.5;

  return expectedDamage * damageWeight + expectedBlock * blockWeight + 1;
}

/**
 * Pick CIPHER's card. Decides hint honoring internally (70%) so callers
 * can't influence it; returns both the card and whether the hint was honored
 * (resolveTurn grants the shield bonus only on honored hints of matching type).
 */
export function pickCipherCard(input: PickInput): Card {
  const rng = input.rng ?? cryptoRandom;
  const { pool, hintType } = input;

  // Honor the hint 70% of the time by restricting the candidate set to the
  // hinted type; otherwise deliberately bluff with a different type.
  const honor = rng() < HINT_HONOR_RATE;
  let candidates = honor
    ? pool.filter((c) => c.type === hintType)
    : pool.filter((c) => c.type !== hintType);
  if (candidates.length === 0) candidates = pool;

  // Loose play: uniform random. Sharp play: weighted by squared score.
  const sharpness = cipherSharpness(input.playerWins);
  if (rng() > sharpness) {
    return candidates[Math.floor(rng() * candidates.length)];
  }

  const avgShield = pool.reduce((s, c) => s + c.shield, 0) / pool.length;
  const avgDamage = pool.reduce((s, c) => s + c.damage, 0) / pool.length;

  const weights = candidates.map((c) => {
    const score = scoreCard(c, input, avgShield, avgDamage);
    return score * score;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}
