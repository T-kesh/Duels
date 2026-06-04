export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyMessage, type Hex } from "viem";

import { parsePlayerAddress } from "@/lib/addresses";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  getOrCreatePvpSession,
  issueToken,
  slotForAddress,
  buildPublicView,
  challengeMessage,
} from "@/lib/pvpChain";
import { consumeChallengeNonce, setPvpToken } from "@/lib/pvpSessionStore";

interface Body {
  duelId?: string | number;
  address?: string;
  signature?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const duelId = String(body.duelId ?? "").trim();
    const address = parsePlayerAddress(body.address);
    const signature = typeof body.signature === "string" ? (body.signature as Hex) : undefined;

    if (!duelId || !/^[0-9]+$/.test(duelId)) {
      return NextResponse.json({ error: "invalid_duel_id" }, { status: 400 });
    }
    if (!address) {
      return NextResponse.json({ error: "invalid_player_address" }, { status: 400 });
    }
    if (!signature) {
      return NextResponse.json({ error: "missing_signature" }, { status: 400 });
    }

    const limit = await checkRateLimit("pvp-auth", address);
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }

    const nonce = await consumeChallengeNonce(duelId, address);
    if (!nonce) {
      return NextResponse.json({ error: "challenge_expired" }, { status: 400 });
    }

    const ok = await verifyMessage({
      address: address as Hex,
      message: challengeMessage(duelId, address, nonce),
      signature,
    });
    if (!ok) {
      return NextResponse.json({ error: "bad_signature" }, { status: 401 });
    }

    const session = await getOrCreatePvpSession(duelId);
    if (!session) {
      return NextResponse.json({ error: "duel_not_playable" }, { status: 400 });
    }

    const slot = slotForAddress(session, address);
    if (!slot) {
      return NextResponse.json({ error: "not_a_participant" }, { status: 403 });
    }

    const { token, hash } = issueToken();
    await setPvpToken(duelId, slot, hash);

    const view = await buildPublicView(session, slot);
    return NextResponse.json({ token, state: view });
  } catch (err) {
    console.error("/api/pvp/auth/verify", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
