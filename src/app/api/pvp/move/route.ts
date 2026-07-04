export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { parsePlayerAddress } from "@/lib/addresses";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  authenticatePvp,
  submitPickAndMaybeResolve,
  buildPublicView,
} from "@/lib/pvpChain";

interface Body {
  duelId?: string | number;
  address?: string;
  token?: string;
  cardId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const duelId = String(body.duelId ?? "").trim();
    const address = parsePlayerAddress(body.address);
    const cardId = typeof body.cardId === "string" ? body.cardId : undefined;

    if (!duelId || !/^[0-9]+$/.test(duelId) || !address || !cardId) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const limit = await checkRateLimit("pvp-move", address);
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }

    const auth = await authenticatePvp(duelId, address, body.token);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { session, slot } = auth;

    if (session.isOver) {
      return NextResponse.json({ error: "duel_already_complete" }, { status: 400 });
    }
    if (Date.now() > session.roundDeadlineMs) {
      return NextResponse.json({ error: "round_deadline_passed" }, { status: 409 });
    }

    // Resolve the card from the player's OWN authoritative hand — client stats
    // are never trusted (same guarantee as the vs-AI flow).
    const hand = slot === "p1" ? session.p1Hand : session.p2Hand;
    const card = hand.find((c) => c.id === cardId);
    if (!card) {
      return NextResponse.json({ error: "illegal_card_for_session" }, { status: 400 });
    }

    // Reject reusing a card already played in a prior (non-sudden) round.
    const alreadyUsed = session.transcript.some(
      (r) => !r.sudden && (slot === "p1" ? r.p1Card.id : r.p2Card.id) === cardId,
    );
    if (alreadyUsed) {
      return NextResponse.json({ error: "card_already_used" }, { status: 400 });
    }

    const { session: latest } = await submitPickAndMaybeResolve(session, slot, card);
    const view = await buildPublicView(latest, slot);

    return NextResponse.json({ state: view });
  } catch (err) {
    console.error("/api/pvp/move", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
