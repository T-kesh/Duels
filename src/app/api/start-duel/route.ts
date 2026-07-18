export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { verifyMessage, type Hex } from "viem";

import { drawHandWithRng } from "@/constants/cards";
import { initGameState } from "@/lib/gameEngine";
import { createAiDuelSession, saveAiDuelSession } from "@/lib/duelSessionStore";
import { parsePlayerAddress } from "@/lib/addresses";
import { checkRateLimit } from "@/lib/rateLimit";
import { consumeLife } from "@/lib/playerStore";
import { consumeStartDuelChallenge, startDuelChallengeMessage } from "@/lib/duelAuth";
import { randomHint } from "@/lib/cipherStrategy";

interface Body {
  playerAddress?: string;
  signature?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const playerAddress = parsePlayerAddress(body.playerAddress);
    if (!playerAddress) {
      return NextResponse.json({ error: "invalid_player_address" }, { status: 400 });
    }
    const signature = typeof body.signature === "string" ? (body.signature as Hex) : undefined;
    if (!signature) {
      return NextResponse.json({ error: "missing_signature" }, { status: 400 });
    }

    const limit = await checkRateLimit("start-duel", playerAddress);
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }

    // Prove wallet ownership before burning energy or starting a session as
    // this address — otherwise anyone could grief another player's daily
    // lives / win-count by POSTing their address directly.
    const nonce = await consumeStartDuelChallenge(playerAddress);
    if (!nonce) {
      return NextResponse.json({ error: "challenge_expired" }, { status: 400 });
    }
    const ok = await verifyMessage({
      address: playerAddress as Hex,
      message: startDuelChallengeMessage(playerAddress, nonce),
      signature,
    });
    if (!ok) {
      return NextResponse.json({ error: "bad_signature" }, { status: 401 });
    }

    const { ok: hasEnergy, state: playerState } = await consumeLife(playerAddress);
    if (!hasEnergy) {
      return NextResponse.json(
        { error: "no_energy", nextRechargeAt: playerState.nextRechargeAt },
        { status: 403 },
      );
    }

    const duelId = crypto.randomUUID();
    const rng = () => crypto.randomInt(281474976710655) / 281474976710655;
    const hand = drawHandWithRng(playerState.totalWins, rng);

    const session = await createAiDuelSession(duelId, playerAddress);
    session.hand = hand;
    session.stateJson = JSON.stringify(initGameState());
    // Server-generated hint for turn 1 — the client only displays it.
    session.lastAiHintType = randomHint();
    await saveAiDuelSession(session);

    return NextResponse.json({ duelId, hand, aiHintType: session.lastAiHintType });
  } catch (err: unknown) {
    console.error("/api/start-duel", err);
    const message = err instanceof Error ? err.message : "Could not deal hand";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}