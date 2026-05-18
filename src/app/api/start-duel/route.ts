export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { drawHandWithRng } from "@/constants/cards";
import { initGameState } from "@/lib/gameEngine";
import { createAiDuelSession } from "@/lib/duelSessionStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const wins = Math.max(0, Math.floor(Number(body.totalWins ?? 0)));
    const duelId = crypto.randomUUID();

    /** Double `[0,1)` draw — matches Fisher intent well enough while staying uniform-ish. */
    const rng = () => crypto.randomInt(281474976710655) / 281474976710655;


    const hand = drawHandWithRng(wins, rng);

    const session = createAiDuelSession(duelId);
    session.hand = hand;
    session.stateJson = JSON.stringify(initGameState());

    return NextResponse.json({ duelId, hand });
  } catch (err) {
    console.error("/api/start-duel", err);
    return NextResponse.json({ error: "Could not deal hand" }, { status: 500 });
  }
}
