export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

import { initGameState, resolveTurn, type GameState } from "@/lib/gameEngine";
import { getAiDuelSession, saveAiDuelSession } from "@/lib/duelSessionStore";

interface ClaimPayload {
  playerAddress?: string;
  duelId?: string;
}

function replaySession(
  transcript: { playerCard: Parameters<typeof resolveTurn>[1]; aiCard: Parameters<typeof resolveTurn>[2] }[]
): GameState {
  let state = initGameState();
  for (const turn of transcript) {
    state = resolveTurn(state, turn.playerCard, turn.aiCard);
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

    if (!body.playerAddress || !body.duelId) {
      return NextResponse.json({ error: "Invalid claim data" }, { status: 400 });
    }

    const { playerAddress, duelId } = body;

    // ── Fetch session from Redis (survives cold starts) ──────────────────────
    const sessionRecord = await getAiDuelSession(duelId);
    if (!sessionRecord) {
      return NextResponse.json({ error: "unknown_or_expired_duel" }, { status: 404 });
    }

    // ── Guard: no double-claiming ─────────────────────────────────────────────
    if (sessionRecord.rewardSignatureIssued) {
      return NextResponse.json({ error: "reward_already_claimed_for_session" }, { status: 409 });
    }

    // ── Guard: transcript must have turns ────────────────────────────────────
    if (!sessionRecord.transcript.length) {
      return NextResponse.json({ error: "Incomplete duel transcript" }, { status: 400 });
    }

    // ── Server-side game replay for integrity check ──────────────────────────
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

    // ── Sign the reward ──────────────────────────────────────────────────────
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const nonce = ethers.keccak256(
      ethers.solidityPacked(["address", "uint256"], [playerAddress, Date.now()])
    );

    const wallet = new ethers.Wallet(privateKey);
    const message = ethers.keccak256(
      ethers.solidityPacked(["address", "bytes32"], [playerAddress, nonce])
    );
    const signature = await wallet.signMessage(ethers.getBytes(message));

    // ── Mark signature as issued and persist ─────────────────────────────────
    sessionRecord.rewardSignatureIssued = true;
    await saveAiDuelSession(sessionRecord);

    return NextResponse.json({ nonce, signature });
  } catch (err) {
    console.error("claim-reward error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
