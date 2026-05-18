export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

import { Card } from "@/constants/cards";
import { initGameState, resolveTurn, type GameState } from "@/lib/gameEngine";
import { getAiDuelSession, touchSession } from "@/lib/duelSessionStore";

interface ClaimPayload {
  playerAddress?: string;
  duelId?: string;
  turns?: { playerCard: Card; aiCard: Card }[];
}

function simulate(rows: ClaimPayload["turns"]) {
  let current = initGameState();
  if (!rows) return current;
  for (const turn of rows) {
    current = resolveTurn(current, turn.playerCard, turn.aiCard);
  }
  return current;
}

function parseSessionState(raw: string | undefined): GameState | null {
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

    if (!body.playerAddress) {
      return NextResponse.json({ error: "Invalid claim data" }, { status: 400 });
    }

    const playerAddress = body.playerAddress;

    let finalState: GameState | undefined;
    let sessionRecord = undefined as ReturnType<typeof getAiDuelSession>;

    if (body.duelId) {
      sessionRecord = getAiDuelSession(body.duelId);
      if (!sessionRecord) {
        return NextResponse.json({ error: "unknown_or_expired_duel" }, { status: 404 });
      }

      const replay = simulate(
        sessionRecord.transcript.map((t) => ({
          playerCard: t.playerCard,
          aiCard: t.aiCard,
        })),
      );

      finalState = replay;

      const serverSnapshot = parseSessionState(sessionRecord.stateJson);
      const snapshotsMatchSession =
        serverSnapshot !== null &&
        replay.playerHp === serverSnapshot.playerHp &&
        replay.aiHp === serverSnapshot.aiHp &&
        replay.turn === serverSnapshot.turn &&
        replay.isOver === serverSnapshot.isOver &&
        replay.playerWon === serverSnapshot.playerWon;

      if (!snapshotsMatchSession || !finalState.isOver || !finalState.playerWon) {
        return NextResponse.json({ error: "Game not eligible for reward" }, { status: 403 });
      }

      if (!sessionRecord.transcript.length) {
        return NextResponse.json({ error: "Incomplete duel transcript" }, { status: 400 });
      }

      if (sessionRecord.rewardSignatureIssued) {
        return NextResponse.json({ error: "reward_already_claimed_for_session" }, { status: 409 });
      }
    } else if (body.turns?.length) {
      finalState = simulate(body.turns);
      if (!finalState.isOver || !finalState.playerWon) {
        return NextResponse.json({ error: "Game not eligible for reward" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "Invalid claim data" }, { status: 400 });
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

    if (sessionRecord) {
      sessionRecord.rewardSignatureIssued = true;
      touchSession(sessionRecord);
    }

    return NextResponse.json({ nonce, signature });
  } catch (err) {
    console.error("claim-reward error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
