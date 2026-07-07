export const dynamic = 'force-dynamic';
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { parsePlayerAddress } from "@/lib/addresses";
import { checkRateLimit } from "@/lib/rateLimit";
import { authenticatePvp, buildPublicView } from "@/lib/pvpChain";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const duelId = String(sp.get("duelId") ?? "").trim();
    const address = parsePlayerAddress(sp.get("address"));
    const token = sp.get("token") ?? undefined;

    if (!duelId || !/^[0-9]+$/.test(duelId) || !address) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const limit = await checkRateLimit("pvp-state", address);
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }

    const auth = await authenticatePvp(duelId, address, token);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const view = await buildPublicView(auth.session, auth.slot);
    return NextResponse.json({ state: view });
  } catch (err) {
    console.error("/api/pvp/state", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
