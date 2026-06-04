export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { parsePlayerAddress } from "@/lib/addresses";
import { checkRateLimit } from "@/lib/rateLimit";
import { authenticatePvp, buildPublicView } from "@/lib/pvpChain";
import {
  getPvpPick,
  acquireRoundResolveLock,
  savePvpSession,
  getPvpSession,
} from "@/lib/pvpSessionStore";

interface Body {
  duelId?: string | number;
  address?: string;
  token?: string;
}

/**
 * Claim a win when the opponent abandons. Only valid once the round deadline has
 * passed AND the caller submitted this round while the opponent did not. If both
 * sides missed the deadline, no automatic forfeit is granted (manual resolution).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const duelId = String(body.duelId ?? "").trim();
    const address = parsePlayerAddress(body.address);

    if (!duelId || !/^[0-9]+$/.test(duelId) || !address) {
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
    const oppSlot = slot === "p1" ? "p2" : "p1";

    if (session.isOver) {
      const view = await buildPublicView(session, slot);
      return NextResponse.json({ state: view });
    }

    if (Date.now() <= session.roundDeadlineMs) {
      return NextResponse.json({ error: "deadline_not_reached" }, { status: 400 });
    }

    const [yourPick, oppPick] = await Promise.all([
      getPvpPick(duelId, session.round, slot),
      getPvpPick(duelId, session.round, oppSlot),
    ]);

    if (!yourPick || oppPick) {
      // Either you also didn't move, or the opponent did move — no forfeit.
      return NextResponse.json({ error: "no_forfeit_available" }, { status: 400 });
    }

    // Serialize with round resolution so a late opponent move can't collide.
    const gotLock = await acquireRoundResolveLock(duelId, session.round);
    if (!gotLock) {
      const latest = (await getPvpSession(duelId)) ?? session;
      const view = await buildPublicView(latest, slot);
      return NextResponse.json({ state: view });
    }

    session.isOver = true;
    session.winnerSlot = slot;
    await savePvpSession(session);

    const view = await buildPublicView(session, slot);
    return NextResponse.json({ state: view, forfeit: true });
  } catch (err) {
    console.error("/api/pvp/forfeit", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
