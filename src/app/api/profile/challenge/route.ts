export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { parsePlayerAddress } from "@/lib/addresses";
import { checkRateLimit } from "@/lib/rateLimit";
import { normalizeDisplayName } from "@/lib/nameStore";
import { profileChallengeMessage, setProfileChallenge } from "@/lib/profileAuth";

interface Body {
  address?: string;
  name?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const address = parsePlayerAddress(body.address);
    if (!address) {
      return NextResponse.json({ error: "invalid_player_address" }, { status: 400 });
    }

    // Reject bad names before the wallet prompt, not after.
    const name = normalizeDisplayName(body.name);
    if (!name) {
      return NextResponse.json({ error: "invalid_name" }, { status: 400 });
    }

    const limit = await checkRateLimit("profile-auth", address);
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }

    const nonce = crypto.randomBytes(16).toString("hex");
    await setProfileChallenge(address, nonce);

    return NextResponse.json({ nonce, message: profileChallengeMessage(address, name, nonce) });
  } catch (err) {
    console.error("/api/profile/challenge", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
