export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { drawHandWithRng } from "@/constants/cards";
import { initGameState } from "@/lib/gameEngine";
import { createAiDuelSession, saveAiDuelSession } from "@/lib/duelSessionStore";
import { parsePlayerAddress } from "@/lib/addresses";
import { checkRateLimit } from "@/lib/rateLimit";
import { consumeLife } from "@/lib/playerStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const playerAddress = parsePlayerAddress(body.playerAddress);
    if (!playerAddress) {
      return NextResponse.json({ error: "invalid_player_address" }, { status: 400 });
    }

    const limit = await checkRateLimit("start-duel", playerAddress);
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }

    const { ok, state: playerState } = await consumeLife(playerAddress);
    if (!ok) {
      return NextResponse.json(
        {
          error: "no_energy",
          nextRechargeAt: playerState.nextRechargeAt,
        },
        { status: 403 },
      );
    }

    const duelId = crypto.randomUUID();
    const rng = () => crypto.randomInt(281474976710655) / 281474976710655;
    const hand = drawHandWithRng(playerState.totalWins, rng);

    const session = await createAiDuelSession(duelId, playerAddress);
    session.hand = hand;
    session.stateJson = JSON.stringify(initGameState());
    await saveAiDuelSession(session);

    return NextResponse.json({ duelId, hand });
  } catch (err: unknown) {
    console.error("/api/start-duel", err);
    const message = err instanceof Error ? err.message : "Could not deal hand";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
