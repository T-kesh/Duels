export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { parsePlayerAddress } from "@/lib/addresses";
import { checkRateLimit } from "@/lib/rateLimit";
import { setStartDuelChallenge, startDuelChallengeMessage } from "@/lib/duelAuth";

interface Body {
  address?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const address = parsePlayerAddress(body.address);
    if (!address) {
      return NextResponse.json({ error: "invalid_player_address" }, { status: 400 });
    }

    const limit = await checkRateLimit("start-duel-auth", address);
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }

    const nonce = crypto.randomBytes(16).toString("hex");
    await setStartDuelChallenge(address, nonce);

    return NextResponse.json({ nonce, message: startDuelChallengeMessage(address, nonce) });
  } catch (err) {
    console.error("/api/start-duel/challenge", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}