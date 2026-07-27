import { Card, STARTING_HP } from "@/constants/cards";
import { calcDamageDealtUnified } from "@/lib/combat";
import { detectCombo } from "@/lib/combos";

export type AiHintType = "attack" | "defend" | "special";

export interface TurnResult {
  playerCard: Card;
  aiCard: Card;
  playerDamageDealt: number;
  aiDamageDealt: number;
  playerHpAfter: number;
  aiHpAfter: number;
  playerCombo?: string;
  aiCombo?: string;
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
  
  let playerComboName: string | undefined;
  let aiComboName: string | undefined;
  let playerDmgMultiplier = 1;
  let playerBonusShield = 0;
  let playerHealOverride = 0;
  let aiDmgMultiplier = 1;
  let aiComboShield = 0;
  let aiHealOverride = 0;

  if (state.turns.length > 0) {
    const lastTurn = state.turns[state.turns.length - 1];
    const pCombo = detectCombo(lastTurn.playerCard, playerCard);
    if (pCombo) {
      playerComboName = pCombo.name;
      playerDmgMultiplier += pCombo.bonusDamagePercent;
      playerBonusShield += pCombo.bonusShield;
      playerHealOverride = pCombo.bonusHealOverride;
    }
    const aCombo = detectCombo(lastTurn.aiCard, aiCard);
    if (aCombo) {
      aiComboName = aCombo.name;
      aiDmgMultiplier += aCombo.bonusDamagePercent;
      aiComboShield += aCombo.bonusShield;
      aiHealOverride = aCombo.bonusHealOverride;
    }
  }

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

  const pDamage = playerCard.damage * playerDmgMultiplier;
  const aDamage = aiCard.damage * aiDmgMultiplier;

  const playerDamageDealt = calcDamageDealtUnified(pDamage, aiCard.shield, aiBonusShield + aiComboShield, isClutchTurn, playerCard.piercing ?? 0);
  const aiDamageDealt = calcDamageDealtUnified(aDamage, playerCard.shield, playerBonusShield, isClutchTurn, aiCard.piercing ?? 0);

  // Lifesteal calculation (50% of total damage dealt, including pierce)
  const pHealRate = playerHealOverride > 0 ? playerHealOverride : 0.5;
  const aHealRate = aiHealOverride > 0 ? aiHealOverride : 0.5;
  const playerHeal = playerCard.id.startsWith("drain") ? Math.floor(playerDamageDealt * pHealRate) : 0;
  const aiHeal = aiCard.id.startsWith("drain") ? Math.floor(aiDamageDealt * aHealRate) : 0;

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
    playerCombo: playerComboName,
    aiCombo: aiComboName,
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
