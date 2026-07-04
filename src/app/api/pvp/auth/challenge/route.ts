export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { zeroAddress } from "viem";

import { parsePlayerAddress } from "@/lib/addresses";
import { checkRateLimit } from "@/lib/rateLimit";
import { readOnChainDuel, challengeMessage } from "@/lib/pvpChain";
import { setChallengeNonce } from "@/lib/pvpSessionStore";

interface Body {
  duelId?: string | number;
  address?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const duelId = String(body.duelId ?? "").trim();
    const address = parsePlayerAddress(body.address);

    if (!duelId || !/^[0-9]+$/.test(duelId)) {
      return NextResponse.json({ error: "invalid_duel_id" }, { status: 400 });
    }
    if (!address) {
      return NextResponse.json({ error: "invalid_player_address" }, { status: 400 });
    }

    const limit = await checkRateLimit("pvp-auth", address);
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }

    const duel = await readOnChainDuel(BigInt(duelId));
    if (!duel || !duel.isActive) {
      return NextResponse.json({ error: "duel_not_active" }, { status: 400 });
    }
    if (duel.player2 === zeroAddress) {
      return NextResponse.json({ error: "duel_not_joined_yet" }, { status: 400 });
    }
    if (address !== duel.player1 && address !== duel.player2) {
      return NextResponse.json({ error: "not_a_participant" }, { status: 403 });
    }

    const nonce = crypto.randomBytes(16).toString("hex");
    await setChallengeNonce(duelId, address, nonce);

    return NextResponse.json({ nonce, message: challengeMessage(duelId, address, nonce) });
  } catch (err) {
    console.error("/api/pvp/auth/challenge", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
