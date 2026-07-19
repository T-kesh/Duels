export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAiDuelSession, saveAiDuelSession } from "@/lib/duelSessionStore";
import { checkRateLimit } from "@/lib/rateLimit";

interface ConfirmHandPayload {
  duelId?: string;
  pickedCardIds?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ConfirmHandPayload;
    const { duelId, pickedCardIds } = body;

    if (!duelId || !pickedCardIds || !Array.isArray(pickedCardIds) || pickedCardIds.length !== 3) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const session = await getAiDuelSession(duelId);
    if (!session || !session.dealtPool || session.dealtPool.length === 0) {
      return NextResponse.json({ error: "unknown_or_expired_duel" }, { status: 404 });
    }

    // Rate limit check
    const limit = await checkRateLimit("confirm-hand", session.playerAddress);
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }

    // Verify all pickedCardIds are valid items in the dealt pool
    const hand = [];
    const poolMap = new Map(session.dealtPool.map((c) => [c.id, c]));
    
    for (const id of pickedCardIds) {
      const card = poolMap.get(id);
      if (!card) {
        return NextResponse.json({ error: "illegal_card_picked" }, { status: 400 });
      }
      hand.push(card);
    }

    // The other 3 leftover cards become CIPHER's pool
    const pickedSet = new Set(pickedCardIds);
    const cipherPool = session.dealtPool.filter((c) => !pickedSet.has(c.id));

    session.hand = hand;
    session.cipherPool = cipherPool;
    await saveAiDuelSession(session);

    return NextResponse.json({ hand });
  } catch (err: unknown) {
    console.error("/api/confirm-hand", err);
    const message = err instanceof Error ? err.message : "confirm_hand_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
