export const dynamic = 'force-dynamic';
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { initGameState, resolveTurn, type GameState, type AiHintType } from "@/lib/gameEngine";
import { getAiDuelSession } from "@/lib/duelSessionStore";
import { parsePlayerAddress } from "@/lib/addresses";

function replaySession(
  transcript: {
    playerCard: Parameters<typeof resolveTurn>[1];
    aiCard: Parameters<typeof resolveTurn>[2];
    aiHintType?: AiHintType;
  }[],
): GameState {
  let state = initGameState();
  for (const turn of transcript) {
    state = resolveTurn(state, turn.playerCard, turn.aiCard, turn.aiHintType);
  }
  return state;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const duelId = sp.get("duelId");
    const address = parsePlayerAddress(sp.get("address"));

    if (!duelId || !address) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const session = await getAiDuelSession(duelId);
    if (!session) {
      return NextResponse.json({ error: "unknown_or_expired_duel" }, { status: 404 });
    }
    if (session.playerAddress !== address) {
      return NextResponse.json({ error: "player_address_mismatch" }, { status: 403 });
    }

    // Recompute from the authoritative transcript rather than trusting the
    // cached stateJson snapshot verbatim — this endpoint exists specifically
    // to resolve disagreements about what actually happened.
    const state = replaySession(session.transcript);

    return NextResponse.json({
      hand: session.hand,
      playerHp: state.playerHp,
      aiHp: state.aiHp,
      turn: state.turn,
      isOver: state.isOver,
      playerWon: state.playerWon,
      turns: state.turns,
      usedCardIds: session.transcript.map((t) => t.playerCard.id),
    });
  } catch (err) {
    console.error("/api/duel-state", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}