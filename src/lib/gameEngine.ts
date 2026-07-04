import { Card, STARTING_HP } from "@/constants/cards";

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
export const CLUTCH_DAMAGE_MULTIPLIER = 1.1;

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

/** Damage dealt by attacker against defender shield (+ optional AI hint bonus shield). */
export function calcDamageDealt(
  attackerDamage: number,
  defenderShield: number,
  extraDefenderShield = 0,
): number {
  return Math.max(0, attackerDamage - defenderShield - extraDefenderShield);
}

/** Preview damage this card deals against a defender shield value. */
export function previewDamage(attacker: Card, defenderShield: number, extraDefenderShield = 0): number {
  return calcDamageDealt(attacker.damage, defenderShield, extraDefenderShield);
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
  const aiBonusShield = hintHonored ? HINT_SHIELD_BONUS : 0;

  let playerDamageDealt = calcDamageDealt(playerCard.damage, aiCard.shield, aiBonusShield);
  let aiDamageDealt = calcDamageDealt(aiCard.damage, playerCard.shield);

  if (isClutchTurn) {
    playerDamageDealt = Math.floor(playerDamageDealt * CLUTCH_DAMAGE_MULTIPLIER);
    aiDamageDealt = Math.floor(aiDamageDealt * CLUTCH_DAMAGE_MULTIPLIER);
  }

  const newPlayerHp = Math.max(0, playerHp - aiDamageDealt);
  const newAiHp = Math.max(0, aiHp - playerDamageDealt);

  const newTurn = state.turn + 1;
  const isOver = newTurn > 3 || newPlayerHp <= 0 || newAiHp <= 0;

  let playerWon: boolean | null = null;
  if (isOver) {
    if (newPlayerHp > newAiHp) playerWon = true;
    else if (newAiHp > newPlayerHp) playerWon = false;
    else playerWon = true;
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
