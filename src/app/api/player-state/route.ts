export const dynamic = 'force-dynamic';
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { parsePlayerAddress } from "@/lib/addresses";
import { getPlayerState, MAX_LIVES } from "@/lib/playerStore";

export async function GET(req: NextRequest) {
  try {
    const address = parsePlayerAddress(req.nextUrl.searchParams.get("address"));
    if (!address) {
      return NextResponse.json({ error: "invalid_player_address" }, { status: 400 });
    }

    // NOTE: the old `seedWins` migration parameter was removed deliberately —
    // it let any client set an arbitrary totalWins, which unlocks tier-3
    // cards and (on V2) feeds reward-tier inputs. Wins are now earned only
    // through server-resolved duels.

    const state = await getPlayerState(address);

    return NextResponse.json({
      lives: state.energy.lives,
      bonusLives: state.energy.bonusLives,
      totalPlaysRemaining: state.energy.lives + state.energy.bonusLives,
      nextRechargeAt: state.nextRechargeAt,
      totalWins: state.totalWins,
      maxLives: MAX_LIVES,
    });
  } catch (err: unknown) {
    console.error("/api/player-state", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
