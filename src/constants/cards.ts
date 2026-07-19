export type CardType = "attack" | "defend" | "special";

export interface Card {
  id: string;
  name: string;
  type: CardType;
  tier: number;        // 1: Common, 2: Rare, 3: Epic
  damage: number;      // HP dealt to opponent
  shield: number;      // HP blocked this turn
  piercing?: number;   // HP that bypasses shield (Drain mechanic)
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
    damage: 25,
    shield: 0,
    piercing: 10,
    description: "Siphon life force. Pierces shields. Lifesteals 50%.",
    emoji: "🩸",
  },
];

// Generate tiered versions of base cards
function scaleTiered(c: Card, tier: number, multiplier: number): Card {
  const suffix = tier === 2 ? "_t2" : "_t3";
  const label = tier === 2 ? "II" : "III";
  return {
    ...c,
    id: `${c.id}${suffix}`,
    name: `${c.name} ${label}`,
    tier,
    damage: Math.floor(c.damage * multiplier),
    shield: Math.floor(c.shield * multiplier),
    piercing: c.piercing ? Math.floor(c.piercing * multiplier) : undefined,
  };
}

export function getTieredPool(wins: number): Card[] {
  let pool = [...CARDS];
  
  // Unlock Tier 2 at 5 wins
  if (wins >= 5) {
    pool = [...pool, ...CARDS.map(c => scaleTiered(c, 2, 1.3))];
  }
  
  // Unlock Tier 3 at 15 wins
  if (wins >= 15) {
    pool = [...pool, ...CARDS.map(c => scaleTiered(c, 3, 1.6))];
  }
  
  return pool;
}

// Player draws cards per game based on their progress.
export function drawHand(wins: number = 0, count: number = 3): Card[] {
  return drawHandWithRng(wins, Math.random, count);
}

/**
 * Draw a hand using an injected RNG. `/api/start-duel` passes a crypto RNG.
 *
 * Tier composition rules (keeps the game balanced for veterans):
 *   For count=3: at most 1 tier-3, at most 1 tier-2, rest tier-1.
 *   For count=6 (lottery pool): at most 2 tier-3, at most 2 tier-2, rest tier-1.
 *   Proportional scaling: the caps double when the pool size doubles.
 *
 * Fisher–Yates is used for every within-tier shuffle for an unbiased draw.
 */
export function drawHandWithRng(wins: number, random: () => number, count: number = 3): Card[] {
  const hasTier3 = wins >= 15;
  const hasTier2 = wins >= 5;

  const tier1 = CARDS;
  const tier2Cards = hasTier2 ? CARDS.map((c) => scaleTiered(c, 2, 1.3)) : [];
  const tier3Cards = hasTier3 ? CARDS.map((c) => scaleTiered(c, 3, 1.6)) : [];

  // Proportional tier caps: scale with pool size.
  // count=3 → max 1 epic, max 1 rare. count=6 → max 2 epic, max 2 rare.
  const scaleFactor = count / 3;
  const maxT3 = Math.floor(1 * scaleFactor); // 1 per 3 cards
  const maxT2 = Math.floor(1 * scaleFactor); // 1 per 3 cards

  // Roll for each tier-3 slot independently (30% each).
  let t3Count = 0;
  if (hasTier3) {
    for (let i = 0; i < maxT3; i++) {
      if (random() < 0.3) t3Count++;
    }
  }
  // Roll for each tier-2 slot independently (55% each).
  let t2Count = 0;
  if (hasTier2) {
    for (let i = 0; i < maxT2; i++) {
      if (random() < 0.55) t2Count++;
    }
  }
  const t1Count = count - t3Count - t2Count;

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
