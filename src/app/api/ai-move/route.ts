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
import { grantPerfectDuelBonus, incrementWins, getTotalWins } from "@/lib/playerStore";

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

    // Resolve the authoritative card from the server-dealt hand. The client
    // only supplies an id; its damage/shield values are NEVER trusted, or a
    // player could inflate stats and forge a winning (claimable) transcript.
    const authoritativeCard = session.hand.find((c) => c.id === playerCard.id);
    if (!authoritativeCard) {
      return NextResponse.json({ error: "illegal_card_for_session" }, { status: 400 });
    }

    const pickedIds = new Set(session.transcript.map((round) => round.playerCard.id));
    if (pickedIds.has(authoritativeCard.id)) {
      return NextResponse.json({ error: "card_already_used" }, { status: 400 });
    }

    const gameState = safeParseGameState(session.stateJson) ?? initGameState();
    if (gameState.isOver) {
      return NextResponse.json({ error: "duel_already_complete" }, { status: 400 });
    }

    // Get player's current wins to scale difficulty and draw AI cards from correct tier pool
    const playerWins = await getTotalWins(session.playerAddress);
    
    // Build AI's available tiered card pool
    const { getTieredPool } = await import("@/constants/cards");
    const aiPool = getTieredPool(playerWins);

    const prompt = buildCipherPrompt({
      playerCard: authoritativeCard,
      aiHp: gameState.aiHp,
      playerHp: gameState.playerHp,
      turn: gameState.turn,
      aiHintType,
      // Streak is client-supplied (cosmetic narrative only; no game outcome impact).
      streak: Number(history.streak ?? 0),
      // Use server-verified win count so the client cannot inflate CIPHER's difficulty.
      totalWins: playerWins,
      recentDuels,
    });

    const { card: rawCard, reasoning } = await fetchCipherPick(prompt);

    // Enforce that AI card is selected from its tiered pool. Fallback if LLM output fails
    let card = aiPool.find((c) => c.id === rawCard.id) || aiPool[0];

    // Decouple LLM move from the hint: 70% probability to honor the hint.
    // If we roll to NOT honor the hint and the LLM picked a card matching the hint category,
    // we swap it to a different category.
    const shouldHonorHint = Math.random() < 0.70;
    if (!shouldHonorHint && card.type === aiHintType) {
      // Find cards of other types in the AI pool
      const nonHintCards = aiPool.filter((c) => c.type !== aiHintType);
      if (nonHintCards.length > 0) {
        card = nonHintCards[Math.floor(Math.random() * nonHintCards.length)];
      }
    } else if (shouldHonorHint && card.type !== aiHintType) {
      // If we roll to honor the hint but LLM picked something else, force-swap to matching type
      const matchingCards = aiPool.filter((c) => c.type === aiHintType);
      if (matchingCards.length > 0) {
        card = matchingCards[Math.floor(Math.random() * matchingCards.length)];
      }
    }

    const nextState = resolveTurn(gameState, authoritativeCard, card, aiHintType);

    session.transcript.push({ playerCard: authoritativeCard, aiCard: card, aiHintType });
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

    const state = {
      playerHp: nextState.playerHp,
      aiHp: nextState.aiHp,
      turn: nextState.turn,
      isOver: nextState.isOver,
      playerWon: nextState.playerWon,
      turnsCount: nextState.turns.length,
      lastTurn: nextState.turns[nextState.turns.length - 1] ?? null,
      perfectDuelBonus,
    };

    return NextResponse.json({ card, reasoning, state });
  } catch (err: unknown) {
    console.error("/api/ai-move", err);
    const message = err instanceof Error ? err.message : "ai_move_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
