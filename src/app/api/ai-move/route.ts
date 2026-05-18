export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import type { Card } from "@/constants/cards";
import { fetchCipherPick, buildCipherPrompt } from "@/lib/cipherAnthropic";
import { resolveTurn, initGameState, type GameState } from "@/lib/gameEngine";
import { getAiDuelSession, touchSession } from "@/lib/duelSessionStore";

type DuelHistoryEntry = {
  won: boolean;
  playerHp: number;
  aiHp: number;
};

interface AiMovePayload {
  duelId: string;
  playerCard: Card;
  aiHintType?: string | null;
  aiHp?: number;
  playerHp?: number;
  turn?: number;
  history?: { streak?: number; totalWins?: number };
  recentDuels?: DuelHistoryEntry[];
}

function safeParseGameState(raw: string): GameState | null {
  try {
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as AiMovePayload;

  const {
    duelId,
    playerCard,
    aiHintType = "special",
    history = {},
    recentDuels = [],
  } = body;

  if (!duelId || !playerCard?.id) {
    return NextResponse.json({ error: "missing_duel_session" }, { status: 400 });
  }

  const session = getAiDuelSession(duelId);
  if (!session?.hand?.length || !session.stateJson) {
    return NextResponse.json({ error: "unknown_or_expired_duel" }, { status: 404 });
  }

  const dealtIds = session.hand.map((c) => c.id);
  if (!dealtIds.includes(playerCard.id)) {
    return NextResponse.json({ error: "illegal_card_for_session" }, { status: 400 });
  }

  const pickedIds = new Set(session.transcript.map((round) => round.playerCard.id));
  if (pickedIds.has(playerCard.id)) {
    return NextResponse.json({ error: "card_already_used" }, { status: 400 });
  }

  let gameState = safeParseGameState(session.stateJson) ?? initGameState();
  if (gameState.isOver) {
    return NextResponse.json({ error: "duel_already_complete" }, { status: 400 });
  }

  const prompt = buildCipherPrompt({
    playerCard,
    aiHp: gameState.aiHp,
    playerHp: gameState.playerHp,
    turn: gameState.turn,
    aiHintType: String(aiHintType),
    streak: Number(history.streak ?? 0),
    totalWins: Number(history.totalWins ?? 0),
    recentDuels,
  });

  const { card, reasoning } = await fetchCipherPick(prompt);

  const nextState = resolveTurn(gameState, playerCard, card);

  session.transcript.push({ playerCard, aiCard: card });
  session.stateJson = JSON.stringify(nextState);
  touchSession(session);

  const publicState = {
    playerHp: nextState.playerHp,
    aiHp: nextState.aiHp,
    turn: nextState.turn,
    isOver: nextState.isOver,
    playerWon: nextState.playerWon,
    turnsCount: nextState.turns.length,
  };

  return NextResponse.json({
    card,
    reasoning,
    state: publicState,
    gameState: nextState,
  });
}
