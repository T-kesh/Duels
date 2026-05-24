export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import type { Card } from "@/constants/cards";
import { fetchCipherPick, buildCipherPrompt } from "@/lib/cipherAnthropic";
import { STARTING_HP } from "@/constants/cards";
import { resolveTurn, initGameState, type GameState } from "@/lib/gameEngine";
import {
  getAiDuelSession,
  saveAiDuelSession,
  type AiHintType,
} from "@/lib/duelSessionStore";
import { checkRateLimit } from "@/lib/rateLimit";
import { grantPerfectDuelBonus, incrementWins } from "@/lib/playerStore";

type DuelHistoryEntry = {
  won: boolean;
  playerHp: number;
  aiHp: number;
};

interface AiMovePayload {
  duelId: string;
  playerCard: Card;
  aiHintType?: string | null;
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

function parseHintType(raw: unknown): AiHintType {
  if (raw === "attack" || raw === "defend" || raw === "special") return raw;
  return "special";
}

function publicStateFromGameState(gameState: GameState, perfectDuelBonus = false) {
  return {
    playerHp: gameState.playerHp,
    aiHp: gameState.aiHp,
    turn: gameState.turn,
    isOver: gameState.isOver,
    playerWon: gameState.playerWon,
    turnsCount: gameState.turns.length,
    lastTurn: gameState.turns[gameState.turns.length - 1] ?? null,
    perfectDuelBonus,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AiMovePayload;

    const { duelId, playerCard, history = {}, recentDuels = [] } = body;
    const aiHintType = parseHintType(body.aiHintType);

    if (!duelId || !playerCard?.id) {
      return NextResponse.json({ error: "missing_duel_session" }, { status: 400 });
    }

    const session = await getAiDuelSession(duelId);
    if (!session?.hand?.length || !session.stateJson) {
      return NextResponse.json({ error: "unknown_or_expired_duel" }, { status: 404 });
    }

    const limit = await checkRateLimit("ai-move", session.playerAddress);
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }

    const dealtIds = session.hand.map((c) => c.id);
    if (!dealtIds.includes(playerCard.id)) {
      return NextResponse.json({ error: "illegal_card_for_session" }, { status: 400 });
    }

    const gameState = safeParseGameState(session.stateJson) ?? initGameState();

    const pickedIds = new Set(session.transcript.map((round) => round.playerCard.id));
    if (pickedIds.has(playerCard.id)) {
      const lastRound = session.transcript[session.transcript.length - 1];
      const lastTurn = gameState.turns[gameState.turns.length - 1];

      if (lastRound?.playerCard.id === playerCard.id && lastTurn) {
        return NextResponse.json({
          card: lastRound.aiCard,
          reasoning: "Recovered last turn.",
          state: publicStateFromGameState(gameState),
          recovered: true,
        });
      }

      return NextResponse.json({ error: "card_already_used" }, { status: 400 });
    }

    if (gameState.isOver) {
      return NextResponse.json({ error: "duel_already_complete" }, { status: 400 });
    }

    const prompt = buildCipherPrompt({
      playerCard,
      aiHp: gameState.aiHp,
      playerHp: gameState.playerHp,
      turn: gameState.turn,
      aiHintType,
      streak: Number(history.streak ?? 0),
      totalWins: Number(history.totalWins ?? 0),
      recentDuels,
    });

    const { card, reasoning } = await fetchCipherPick(prompt);

    const nextState = resolveTurn(gameState, playerCard, card, aiHintType);

    session.transcript.push({ playerCard, aiCard: card, aiHintType });
    session.stateJson = JSON.stringify(nextState);
    session.lastAiHintType = aiHintType;
    await saveAiDuelSession(session);

    let perfectDuelBonus = false;
    if (nextState.isOver && nextState.playerWon) {
      await incrementWins(session.playerAddress);
      if (nextState.playerHp >= Math.floor(STARTING_HP * 0.8)) {
        await grantPerfectDuelBonus(session.playerAddress);
        perfectDuelBonus = true;
      }
    }

    const state = publicStateFromGameState(nextState, perfectDuelBonus);

    return NextResponse.json({ card, reasoning, state });
  } catch (err: unknown) {
    console.error("/api/ai-move", err);
    const message = err instanceof Error ? err.message : "ai_move_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
