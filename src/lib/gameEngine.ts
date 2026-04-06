import { Card, STARTING_HP } from "@/constants/cards";

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

export function resolveTurn(
  state: GameState,
  playerCard: Card,
  aiCard: Card
): GameState {
  const { playerHp, aiHp } = state;

  // Damage dealt = attacker damage - defender shield (min 0)
  const playerDamageDealt = Math.max(0, playerCard.damage - aiCard.shield);
  const aiDamageDealt = Math.max(0, aiCard.damage - playerCard.shield);

  const newPlayerHp = Math.max(0, playerHp - aiDamageDealt);
  const newAiHp = Math.max(0, aiHp - playerDamageDealt);

  const newTurn = state.turn + 1;
  const isOver = newTurn > 3 || newPlayerHp <= 0 || newAiHp <= 0;

  // Determine winner — if game ends, higher HP wins; ties go to player
  let playerWon: boolean | null = null;
  if (isOver) {
    if (newPlayerHp > newAiHp) playerWon = true;
    else if (newAiHp > newPlayerHp) playerWon = false;
    else playerWon = true; // tie = player wins (house is generous for MVP)
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
