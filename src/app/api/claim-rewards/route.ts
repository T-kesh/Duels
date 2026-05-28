export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

import { initGameState, resolveTurn, type GameState, type AiHintType } from "@/lib/gameEngine";
import { getAiDuelSession, saveAiDuelSession } from "@/lib/duelSessionStore";
import { parsePlayerAddress } from "@/lib/addresses";
import { checkRateLimit } from "@/lib/rateLimit";

interface ClaimPayload {
  playerAddress?: string;
  duelId?: string;
}

function replaySession(
  transcript: {
    playerCard: Parameters<typeof resolveTurn>[1];
    aiCard: Parameters<typeof resolveTurn>[2];
    aiHintType?: AiHintType;
  }[],
): GameState {
  let state = initGameState();
  for (const turn of transcript) {
    state = resolveTurn(state, turn.playerCard, turn.aiCard, turn.aiHintType);
  }
  return state;
}

function parseGameState(raw: string | undefined): GameState | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: ClaimPayload = await req.json();

    const playerAddress = parsePlayerAddress(body.playerAddress);
    if (!playerAddress || !body.duelId) {
      return NextResponse.json({ error: "Invalid claim data" }, { status: 400 });
    }

    const { duelId } = body;

    const sessionRecord = await getAiDuelSession(duelId);
    if (!sessionRecord) {
      return NextResponse.json({ error: "unknown_or_expired_duel" }, { status: 404 });
    }

    if (sessionRecord.playerAddress !== playerAddress) {
      return NextResponse.json({ error: "player_address_mismatch" }, { status: 403 });
    }

    // Check dupe-signature BEFORE consuming a rate limit slot — retrying
    // a claimed session should never burn the player's rate limit budget.
    if (sessionRecord.rewardSignatureIssued) {
      return NextResponse.json({ error: "reward_already_claimed_for_session" }, { status: 409 });
    }

    const limit = await checkRateLimit("claim-rewards", playerAddress);
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }

    if (!sessionRecord.transcript.length) {
      return NextResponse.json({ error: "Incomplete duel transcript" }, { status: 400 });
    }

    const replay = replaySession(sessionRecord.transcript);
    const serverSnapshot = parseGameState(sessionRecord.stateJson);

    const snapshotValid =
      serverSnapshot !== null &&
      replay.playerHp === serverSnapshot.playerHp &&
      replay.aiHp === serverSnapshot.aiHp &&
      replay.turn === serverSnapshot.turn &&
      replay.isOver === serverSnapshot.isOver &&
      replay.playerWon === serverSnapshot.playerWon;

    if (!snapshotValid || !replay.isOver || !replay.playerWon) {
      return NextResponse.json({ error: "Game not eligible for reward" }, { status: 403 });
    }

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const nonce = ethers.keccak256(
      ethers.solidityPacked(["address", "uint256"], [playerAddress, Date.now()]),
    );

    const wallet = new ethers.Wallet(privateKey);
    const message = ethers.keccak256(
      ethers.solidityPacked(["address", "bytes32"], [playerAddress, nonce]),
    );
    const signature = await wallet.signMessage(ethers.getBytes(message));

    sessionRecord.rewardSignatureIssued = true;
    await saveAiDuelSession(sessionRecord);

    return NextResponse.json({ nonce, signature });
  } catch (err) {
    console.error("claim-reward error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
