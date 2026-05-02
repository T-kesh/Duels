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
    shield: 0,
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
  const pool = getTieredPool(wins);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

export const STARTING_HP = 100;
