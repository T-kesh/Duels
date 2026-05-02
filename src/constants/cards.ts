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

// Player draws 3 random cards per game
export function drawHand(): Card[] {
  const shuffled = [...CARDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

export const STARTING_HP = 100;
