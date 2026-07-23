export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyMessage, type Hex } from "viem";

import { parsePlayerAddress } from "@/lib/addresses";
import { checkRateLimit } from "@/lib/rateLimit";
import { normalizeDisplayName, setName } from "@/lib/nameStore";
import { consumeProfileChallenge, profileChallengeMessage } from "@/lib/profileAuth";

interface Body {
  address?: string;
  name?: string;
  signature?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const address = parsePlayerAddress(body.address);
    if (!address) {
      return NextResponse.json({ error: "invalid_player_address" }, { status: 400 });
    }

    const name = normalizeDisplayName(body.name);
    if (!name) {
      return NextResponse.json({ error: "invalid_name" }, { status: 400 });
    }

    const signature = typeof body.signature === "string" ? (body.signature as Hex) : undefined;
    if (!signature) {
      return NextResponse.json({ error: "missing_signature" }, { status: 400 });
    }

    const limit = await checkRateLimit("profile-set", address);
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }

    // The signed message binds address + name + nonce, so a signature can't
    // be replayed to rename someone else or set a different name.
    const nonce = await consumeProfileChallenge(address);
    if (!nonce) {
      return NextResponse.json({ error: "challenge_expired" }, { status: 400 });
    }
    const ok = await verifyMessage({
      address: address as Hex,
      message: profileChallengeMessage(address, name, nonce),
      signature,
    });
    if (!ok) {
      return NextResponse.json({ error: "bad_signature" }, { status: 401 });
    }

    const result = await setName(address, name);
    if (!result.ok) {
      const status = result.error === "name_taken" ? 409 : result.error === "invalid_name" ? 400 : 503;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ name: result.name });
  } catch (err) {
    console.error("/api/profile", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
