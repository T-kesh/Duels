export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { STARTING_HP, getTieredPool } from "@/constants/cards";
import { fetchCipherFlavor } from "@/lib/cipherAnthropic";
import { pickCipherCard, randomHint } from "@/lib/cipherStrategy";
import { resolveTurn, initGameState, type GameState } from "@/lib/gameEngine";
import { getAiDuelSession, saveAiDuelSession } from "@/lib/duelSessionStore";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  grantPerfectDuelBonus,
  incrementWins,
  getTotalWins,
  getWinStreak,
  resetWinStreak,
} from "@/lib/playerStore";
import { DUEL_REWARDS_VERSION } from "@/constants/contracts";
import { decideReward } from "@/lib/rewardTiers";

interface AiMovePayload {
  duelId?: string;
  playerCard?: { id?: string };
}

function safeParseGameState(raw: string): GameState | null {
  try {
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AiMovePayload;
    const duelId = body.duelId;
    const playerCardId = body.playerCard?.id;

    if (!duelId || !playerCardId) {
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
    const authoritativeCard = session.hand.find((c) => c.id === playerCardId);
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

    const playerWins = await getTotalWins(session.playerAddress);

    // The hint the player saw this pick phase is server-authoritative: it was
    // generated at start-duel (or after the previous turn) and stored on the
    // session. The client can't steer CIPHER toward harmless card types by
    // sending a hint of its choosing — anything in the request body is ignored.
    const aiHintType = session.lastAiHintType ?? "special";

    // CIPHER's card is picked by the server-side strategy engine — an LLM
    // never chooses it, so prompt injection can only ever touch flavor text.
    // Sharpness scales with the player's win count (easier for new players).
    const aiPool = getTieredPool(playerWins);
    const card = pickCipherCard({
      pool: aiPool,
      playerHp: gameState.playerHp,
      aiHp: gameState.aiHp,
      turn: gameState.turn,
      hintType: aiHintType,
      playerWins,
    });

    const nextState = resolveTurn(gameState, authoritativeCard, card, aiHintType);

    // Voice line only — server-derived context, clamped values, no client text.
    const streakBefore = await getWinStreak(session.playerAddress);
    const reasoning = await fetchCipherFlavor({
      aiCard: card,
      playerCard: authoritativeCard,
      playerHp: nextState.playerHp,
      aiHp: nextState.aiHp,
      turn: gameState.turn,
      streak: streakBefore,
      totalWins: playerWins,
    });

    // Roll the hint the player will see on the NEXT pick phase.
    const nextAiHintType = randomHint();

    session.transcript.push({ playerCard: authoritativeCard, aiCard: card, aiHintType });
    session.stateJson = JSON.stringify(nextState);
    session.lastAiHintType = nextAiHintType;
    await saveAiDuelSession(session);

    let perfectDuelBonus = false;
    if (nextState.isOver && nextState.playerWon) {
      await incrementWins(session.playerAddress);

      if (DUEL_REWARDS_VERSION !== 1) {
        const streak = await getWinStreak(session.playerAddress);
        const reward = decideReward(nextState.playerHp, streak);
        session.rewardDecision = {
          tier: reward.tier,
          amountWei: reward.amountWei.toString(),
          flavor: reward.flavor,
        };
      }

      if (nextState.playerHp >= Math.floor(STARTING_HP * 0.8)) {
        await grantPerfectDuelBonus(session.playerAddress);
        perfectDuelBonus = true;
      }
      await saveAiDuelSession(session);
    } else if (nextState.isOver) {
      await resetWinStreak(session.playerAddress);
      await saveAiDuelSession(session);
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

    return NextResponse.json({ card, reasoning, state, nextAiHintType });
  } catch (err: unknown) {
    console.error("/api/ai-move", err);
    const message = err instanceof Error ? err.message : "ai_move_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
