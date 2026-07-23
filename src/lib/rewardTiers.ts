import crypto from "crypto";

/**
 * CIPHER reward tiers — decides how much a win pays and which voice line
 * accompanies it.
 *
 * The number is decided by verifiable play quality (perfect duels, streaks)
 * plus a small random spread; the flavor line matches the payout so
 * "CIPHER is feeling generous" is only ever shown when the pay actually IS
 * generous. LLM output never touches the amount.
 *
 * Expected payout stays inside 0.005–0.01 cUSD:
 *   base    0.005–0.007  (uniform)      — any win
 *   worthy  0.008–0.010  (uniform)      — perfect duel (≥80 HP) or streak ≥ 3
 *   generous 0.012–0.015 (uniform, 10%) — random grace on top of a worthy win
 *
 * All values stay far below the on-chain maxRewardAmount (0.02) ceiling.
 */

export type RewardTier = "base" | "worthy" | "generous";

export interface RewardDecision {
  tier: RewardTier;
  /** Payout in wei (18 decimals). */
  amountWei: bigint;
  /** CIPHER's voice line for this payout. */
  flavor: string;
}

const WEI = BigInt(10) ** BigInt(18);

// Tier bounds in milli-cUSD (1/1000) to keep bigint math exact.
const TIER_BOUNDS: Record<RewardTier, { min: number; max: number }> = {
  base: { min: 5, max: 7 },
  worthy: { min: 8, max: 10 },
  generous: { min: 12, max: 15 },
};

// ~4 % of worthy wins escalate to generous — tunable via env without a deploy.
// Keep this low: the on-screen flavor "CIPHER is feeling generous" should feel
// like a genuine surprise, not a routine event.
const GENEROUS_CHANCE = parseFloat(
  process.env.REWARD_GENEROUS_CHANCE ?? "0.04",
);

const FLAVOR: Record<RewardTier, string[]> = {
  base: [
    "CIPHER transfers the minimum. Barely earned.",
    "A win is a win. CIPHER disagrees it was a good one.",
    "CIPHER pays out, unimpressed.",
    "Take it. CIPHER has already forgotten this duel.",
  ],
  worthy: [
    "CIPHER found your play worthy.",
    "Acceptable execution. CIPHER honors the result.",
    "CIPHER acknowledges a well-fought duel.",
    "Precision noted. CIPHER pays accordingly.",
  ],
  generous: [
    "CIPHER is feeling generous today.",
    "Remarkable. CIPHER rewards excellence it rarely sees.",
    "CIPHER tips its hand — this one deserved more.",
    "Even CIPHER applauds. Enjoy the bonus.",
  ],
};

function seedRandomInt(seed: string, salt: string, minInclusive: number, maxInclusive: number): number {
  const hash = crypto.createHash("sha256").update(`${seed}:${salt}`).digest();
  const num = hash.readUInt32BE(0);
  const range = maxInclusive - minInclusive + 1;
  return minInclusive + (num % range);
}

function randomInt(minInclusive: number, maxInclusive: number, seed?: string, salt = "amount"): number {
  if (seed) {
    return seedRandomInt(seed, salt, minInclusive, maxInclusive);
  }
  return crypto.randomInt(minInclusive, maxInclusive + 1);
}

function pick<T>(arr: T[], seed?: string, salt = "flavor"): T {
  if (seed) {
    const idx = seedRandomInt(seed, salt, 0, arr.length - 1);
    return arr[idx];
  }
  return arr[crypto.randomInt(arr.length)];
}

function milliCusdToWei(milli: number): bigint {
  return (BigInt(milli) * WEI) / BigInt(1000);
}

/**
 * Decide the payout for a won duel.
 *
 * @param finalPlayerHp  player HP at duel end (server-replayed, not client)
 * @param streak         server-known consecutive wins including this one
 * @param startingHp     STARTING_HP constant (default 100)
 * @param seed           optional seed (e.g. duelId) for deterministic decision/recalculation
 */
export function decideReward(
  finalPlayerHp: number,
  streak: number,
  startingHp = 100,
  seed?: string,
): RewardDecision {
  const perfectDuel = finalPlayerHp >= Math.floor(startingHp * 0.8);
  const hotStreak = streak >= 3;

  let tier: RewardTier = "base";
  if (perfectDuel || hotStreak) {
    tier = "worthy";
    // Grace roll: only quality play can be elevated to generous, so the line
    // "CIPHER is feeling generous" always lands on a genuinely strong duel.
    const basisPoints = Math.round(GENEROUS_CHANCE * 10000);
    const roll = seed
      ? seedRandomInt(seed, "tier", 0, 9999)
      : crypto.randomInt(10000);
    if (roll < basisPoints) tier = "generous";
  }

  const { min, max } = TIER_BOUNDS[tier];
  const amountWei = milliCusdToWei(randomInt(min, max, seed, "amount"));

  return { tier, amountWei, flavor: pick(FLAVOR[tier], seed, "flavor") };
}

/** Formats a wei amount as a short cUSD string, e.g. "0.008". */
export function formatRewardCusd(amountWei: bigint): string {
  const milli = Number((amountWei * BigInt(1000)) / WEI);
  return (milli / 1000).toFixed(3);
}
