export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { drawHandWithRng } from "@/constants/cards";
import { initGameState } from "@/lib/gameEngine";
import { createAiDuelSession, saveAiDuelSession } from "@/lib/duelSessionStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const wins = Math.max(0, Math.floor(Number(body.totalWins ?? 0)));
    const duelId = crypto.randomUUID();

    /** Cryptographically-strong RNG for card draw */
    const rng = () => crypto.randomInt(281474976710655) / 281474976710655;

    const hand = drawHandWithRng(wins, rng);

    const session = await createAiDuelSession(duelId);
    session.hand = hand;
    session.stateJson = JSON.stringify(initGameState());
    await saveAiDuelSession(session);

    return NextResponse.json({ duelId, hand });
  } catch (err) {
    console.error("/api/start-duel", err);
    return NextResponse.json({ error: "Could not deal hand" }, { status: 500 });
  }
}
