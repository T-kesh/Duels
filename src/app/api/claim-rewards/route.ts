import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

import { initGameState, resolveTurn } from "@/lib/gameEngine";
import { Card } from "@/constants/cards";

interface ClaimRequest {
  playerAddress: string;
  turns: { playerCard: Card; aiCard: Card }[];
}

export async function POST(req: NextRequest) {
  try {
    const body: ClaimRequest = await req.json();
    const { playerAddress, turns } = body;

    if (!playerAddress || !turns || turns.length === 0) {
      return NextResponse.json({ error: "Invalid claim data" }, { status: 400 });
    }

    // Re-simulate the game server-side to prevent spoofing
    let currentState = initGameState();
    for (const turn of turns) {
      currentState = resolveTurn(currentState, turn.playerCard, turn.aiCard);
    }

    if (!currentState.isOver || !currentState.playerWon) {
      return NextResponse.json({ error: "Game not eligible for reward" }, { status: 403 });
    }

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    // Create a unique nonce using player address + timestamp
    const nonce = ethers.keccak256(
      ethers.solidityPacked(
        ["address", "uint256"],
        [playerAddress, Date.now()]
      )
    );

    // Sign the same message the contract verifies:
    // keccak256(abi.encodePacked(msg.sender, nonce))
    const wallet = new ethers.Wallet(privateKey);
    const message = ethers.keccak256(
      ethers.solidityPacked(
        ["address", "bytes32"],
        [playerAddress, nonce]
      )
    );

    const signature = await wallet.signMessage(ethers.getBytes(message));

    return NextResponse.json({ nonce, signature });
  } catch (err) {
    console.error("claim-reward error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}