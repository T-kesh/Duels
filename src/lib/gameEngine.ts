import { Card, STARTING_HP } from "@/constants/cards";
import { calcDamageDealtUnified } from "@/lib/combat";

export type AiHintType = "attack" | "defend" | "special";

export interface TurnResult {
  playerCard: Card;
  aiCard: Card;
  playerDamageDealt: number;
  aiDamageDealt: number;
  playerHpAfter: number;
  aiHpAfter: number;
}

export interface GameState {
  playerHp: number;
  aiHp: number;
  turn: number; // 1, 2, 3
  turns: TurnResult[];
  isOver: boolean;
  playerWon: boolean | null;
}

export const HINT_SHIELD_BONUS = 5;

export function initGameState(): GameState {
  return {
    playerHp: STARTING_HP,
    aiHp: STARTING_HP,
    turn: 1,
    turns: [],
    isOver: false,
    playerWon: null,
  };
}

/** Preview damage this card deals against a defender shield value. */
export function previewDamage(attacker: Card, defenderShield: number, extraDefenderShield = 0): number {
  return Math.max(0, attacker.damage - defenderShield - extraDefenderShield);
}

export function resolveTurn(
  state: GameState,
  playerCard: Card,
  aiCard: Card,
  aiHintType?: AiHintType,
): GameState {
  const { playerHp, aiHp } = state;
  const isClutchTurn = state.turn === 3;
  const hintHonored = Boolean(aiHintType && aiCard.type === aiHintType);
  
  // Scale AI hint shield bonus dynamically if AI is using tiered cards
  let aiBonusShield = 0;
  if (hintHonored) {
    if (aiCard.tier === 3) {
      aiBonusShield = 8;
    } else if (aiCard.tier === 2) {
      aiBonusShield = 6;
    } else {
      aiBonusShield = HINT_SHIELD_BONUS; // 5
    }
  }

  const playerDamageDealt = calcDamageDealtUnified(playerCard.damage, aiCard.shield, aiBonusShield, isClutchTurn, playerCard.piercing ?? 0);
  const aiDamageDealt = calcDamageDealtUnified(aiCard.damage, playerCard.shield, 0, isClutchTurn, aiCard.piercing ?? 0);

  // Lifesteal calculation (50% of total damage dealt, including pierce)
  const playerHeal = playerCard.id.startsWith("drain") ? Math.floor(playerDamageDealt * 0.5) : 0;
  const aiHeal = aiCard.id.startsWith("drain") ? Math.floor(aiDamageDealt * 0.5) : 0;

  // Apply damage and healing (capped at starting HP)
  const newPlayerHp = Math.min(STARTING_HP, Math.max(0, playerHp - aiDamageDealt + playerHeal));
  const newAiHp = Math.min(STARTING_HP, Math.max(0, aiHp - playerDamageDealt + aiHeal));

  const newTurn = state.turn + 1;
  const isOver = newTurn > 3 || newPlayerHp <= 0 || newAiHp <= 0;

  let playerWon: boolean | null = null;
  if (isOver) {
    if (newPlayerHp > newAiHp) playerWon = true;
    else if (newAiHp > newPlayerHp) playerWon = false;
    else playerWon = true; // Tie-break favors player in AI mode
  }

  const turnResult: TurnResult = {
    playerCard,
    aiCard,
    playerDamageDealt,
    aiDamageDealt,
    playerHpAfter: newPlayerHp,
    aiHpAfter: newAiHp,
  };

  return {
    playerHp: newPlayerHp,
    aiHp: newAiHp,
    turn: newTurn,
    turns: [...state.turns, turnResult],
    isOver,
    playerWon,
  };
}
