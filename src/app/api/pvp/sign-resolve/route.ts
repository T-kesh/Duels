export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { createPublicClient, http, getAddress, isAddress, zeroAddress, type Hex } from "viem";
import { celoAlfajores } from "viem/chains";

import { DUEL_REWARDS_ABI, DUEL_REWARDS_ADDRESS } from "@/constants/contracts";

function rpcClient() {
  const url =
    process.env.CELO_RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    celoAlfajores.rpcUrls.default.http[0];
  return createPublicClient({
    chain: celoAlfajores,
    transport: http(url),
  });
}

interface Body {
  duelId?: string | number | bigint;
  winner?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const parsedId = typeof body.duelId === "string" ? body.duelId.trim() : String(body.duelId ?? "");
    const winnerRaw = typeof body.winner === "string" ? body.winner.trim() : "";

    if (!parsedId || parsedId === "undefined") {
      return NextResponse.json({ error: "missing_duel_id" }, { status: 400 });
    }
    if (!winnerRaw || !isAddress(winnerRaw)) {
      return NextResponse.json({ error: "invalid_winner" }, { status: 400 });
    }

    const duelIdBn = BigInt(parsedId);
    const winnerAddress = getAddress(winnerRaw as Hex);

    const client = rpcClient();
    const contractAddr = (
      process.env.NEXT_PUBLIC_DUEL_REWARDS_ADDRESS || DUEL_REWARDS_ADDRESS
    ).toLowerCase() as Hex;

    const duel = await client.readContract({
      address: contractAddr as `0x${string}`,
      abi: DUEL_REWARDS_ABI,
      functionName: "duels",
      args: [duelIdBn],
    });

    const duelTuple = duel as unknown as readonly [Hex, Hex, bigint, boolean];
    const player1 = getAddress(duelTuple[0]);
    const player2 = getAddress(duelTuple[1]);
    const isActive = duelTuple[3];

    if (!isActive) {
      return NextResponse.json({ error: "duel_not_active" }, { status: 400 });
    }
    if (player2 === zeroAddress) {
      return NextResponse.json({ error: "duel_not_joined_yet" }, { status: 400 });
    }
    const knownParticipant = winnerAddress === player1 || winnerAddress === player2;

    if (!knownParticipant) {
      return NextResponse.json({ error: "winner_must_be_participant" }, { status: 403 });
    }

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const wallet = new ethers.Wallet(privateKey);

    const nonceBytes32 = ethers.hexlify(ethers.randomBytes(32)) as Hex;

    const innerMessage = ethers.keccak256(
      ethers.solidityPacked(
        ["uint256", "address", "bytes32"],
        [duelIdBn, winnerAddress, nonceBytes32],
      ),
    );

    const signature = await wallet.signMessage(ethers.getBytes(innerMessage));

    return NextResponse.json({
      duelId: duelIdBn.toString(),
      winner: winnerAddress,
      nonce: nonceBytes32,
      signature,
      player1,
      player2,
    });
  } catch (err) {
    console.error("pvp sign-resolve:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
