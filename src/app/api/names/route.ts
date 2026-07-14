export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { parsePlayerAddress } from "@/lib/addresses";
import { checkRateLimit } from "@/lib/rateLimit";
import { getNames } from "@/lib/nameStore";

const MAX_BATCH = 100;

export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("addresses") ?? "";
    const addresses = raw
      .split(",")
      .map((a) => parsePlayerAddress(a.trim()))
      .filter((a): a is string => a !== null);

    if (addresses.length === 0) {
      return NextResponse.json({ names: {} });
    }
    if (addresses.length > MAX_BATCH) {
      return NextResponse.json({ error: "too_many_addresses" }, { status: 400 });
    }

    // Public read — rate-limit by caller IP rather than a claimed address.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limit = await checkRateLimit("names-lookup", ip);
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }

    const names = await getNames(addresses);
    return NextResponse.json({ names });
  } catch (err) {
    console.error("/api/names", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
