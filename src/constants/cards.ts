export type CardType = "attack" | "defend" | "special";

export interface Card {
  id: string;
  name: string;
  type: CardType;
  tier: number;        // 1: Common, 2: Rare, 3: Epic
  damage: number;      // HP dealt to opponent
  shield: number;      // HP blocked this turn
  description: string;
  emoji: string;
}

export const CARDS: Card[] = [
  {
    id: "strike",
    name: "Strike",
    type: "attack",
    tier: 1,
    damage: 30,
    shield: 8,
    description: "A direct hit. Clean and simple.",
    emoji: "⚔️",
  },
  {
    id: "block",
    name: "Block",
    type: "defend",
    tier: 1,
    damage: 0,
    shield: 40,
    description: "Absorb incoming damage this turn.",
    emoji: "🛡️",
  },
  {
    id: "surge",
    name: "Surge",
    type: "special",
    tier: 1,
    damage: 50,
    shield: 0,
    description: "Overcharge strike. High risk, high reward.",
    emoji: "⚡",
  },
  {
    id: "counter",
    name: "Counter",
    type: "special",
    tier: 1,
    damage: 20,
    shield: 20,
    description: "Balanced play. Deal and absorb.",
    emoji: "🔄",
  },
  {
    id: "parry",
    name: "Parry",
    type: "defend",
    tier: 1,
    damage: 10,
    shield: 30,
    description: "Deflect and riposte.",
    emoji: "🗡️",
  },
  {
    id: "drain",
    name: "Drain",
    type: "special",
    tier: 1,
    damage: 20,
    shield: 0,
    description: "Siphon life force. Lifesteals 50% of damage dealt.",
    emoji: "🩸",
  },
];

// Generate tiered versions of base cards
export function getTieredPool(wins: number): Card[] {
  let pool = [...CARDS];
  
  // Unlock Tier 2 at 5 wins
  if (wins >= 5) {
    const tier2 = CARDS.map(c => ({
      ...c,
      id: `${c.id}_t2`,
      name: `${c.name} II`,
      tier: 2,
      damage: Math.floor(c.damage * 1.3),
      shield: Math.floor(c.shield * 1.3),
    }));
    pool = [...pool, ...tier2];
  }
  
  // Unlock Tier 3 at 15 wins
  if (wins >= 15) {
    const tier3 = CARDS.map(c => ({
      ...c,
      id: `${c.id}_t3`,
      name: `${c.name} III`,
      tier: 3,
      damage: Math.floor(c.damage * 1.6),
      shield: Math.floor(c.shield * 1.6),
    }));
    pool = [...pool, ...tier3];
  }
  
  return pool;
}

// Player draws 3 random cards per game based on their progress
export function drawHand(wins: number = 0): Card[] {
  return drawHandWithRng(wins, Math.random);
}

/**
 * Draw a hand using an injected RNG. `/api/start-duel` passes a crypto RNG.
 *
 * Tier composition rules (keeps the game balanced for veterans):
 *   - Exactly 3 cards drawn.
 *   - At most 1 tier-3 card (epic). Rolled at 30% when tier-3 cards are unlocked.
 *   - At most 1 tier-2 card (rare). Rolled at 55% when tier-2 cards are unlocked.
 *   - Remainder always tier-1 (common).
 *
 * This prevents the dominant "Surge III + Shield II" opener that made the game
 * trivially easy for players with ≥15 wins. Fisher–Yates is used for every
 * within-tier shuffle for an unbiased draw.
 */
export function drawHandWithRng(wins: number, random: () => number): Card[] {
  const hasTier3 = wins >= 15;
  const hasTier2 = wins >= 5;

  const tier1 = CARDS; // base set, always available
  const tier2Cards = hasTier2
    ? CARDS.map((c) => ({
        ...c,
        id: `${c.id}_t2`,
        name: `${c.name} II`,
        tier: 2 as const,
        damage: Math.floor(c.damage * 1.3),
        shield: Math.floor(c.shield * 1.3),
      }))
    : [];
  const tier3Cards = hasTier3
    ? CARDS.map((c) => ({
        ...c,
        id: `${c.id}_t3`,
        name: `${c.name} III`,
        tier: 3 as const,
        damage: Math.floor(c.damage * 1.6),
        shield: Math.floor(c.shield * 1.6),
      }))
    : [];

  // Decide how many of each tier appear in the hand.
  const includeT3 = hasTier3 && random() < 0.3; // 30% chance
  const includeT2 = hasTier2 && random() < 0.55; // 55% chance
  const t3Count = includeT3 ? 1 : 0;
  const t2Count = includeT2 ? 1 : 0;
  const t1Count = 3 - t3Count - t2Count; // always ≥ 1

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const picked: Card[] = [
    ...shuffle(tier1).slice(0, t1Count),
    ...shuffle(tier2Cards).slice(0, t2Count),
    ...shuffle(tier3Cards).slice(0, t3Count),
  ];

  // Final shuffle so tier order in the hand is random.
  return shuffle(picked);
}

export const STARTING_HP = 100;
