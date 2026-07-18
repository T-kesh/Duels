export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getAddress, zeroAddress, type Hex } from "viem";

import { parsePlayerAddress } from "@/lib/addresses";
import { checkRateLimit } from "@/lib/rateLimit";
import { readOnChainDuel, type OnChainDuel } from "@/lib/pvpChain";
import { getPvpSession, savePvpSession } from "@/lib/pvpSessionStore";
import { determinePvpOutcome, type PvpSlot } from "@/lib/pvpGameEngine";
import { getRedis, setNxEx } from "@/lib/redis";
import { DUEL_REWARDS_ADDRESS, DUEL_REWARDS_VERSION } from "@/constants/contracts";

interface Body {
  duelId?: string | number | bigint;
  /** Accepted for backwards-compat but IGNORED — the winner is server-derived. */
  winner?: string;
}

function winnerAddressFor(slot: PvpSlot, duel: OnChainDuel): string {
  return slot === "p1" ? duel.player1 : duel.player2;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const duelId = String(body.duelId ?? "").trim();

    if (!duelId || !/^[0-9]+$/.test(duelId)) {
      return NextResponse.json({ error: "missing_duel_id" }, { status: 400 });
    }

    // Load the authoritative gameplay session and recompute the winner from the
    // recorded transcript. The client NEVER supplies the winner.
    const session = await getPvpSession(duelId);
    if (!session) {
      return NextResponse.json({ error: "unknown_or_expired_duel" }, { status: 404 });
    }
    if (!session.isOver || !session.winnerSlot) {
      return NextResponse.json({ error: "duel_not_complete" }, { status: 400 });
    }

    const requester = parsePlayerAddress(req.headers.get("x-player-address"));
    const rateKey = requester ?? session.player1;
    const limit = await checkRateLimit("pvp-claim", rateKey);
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }

    // Defense in depth: replay the transcript. A forfeit win has no transcript
    // outcome, so trust the stored winnerSlot only when the duel ended in play.
    let winnerSlot: PvpSlot | null = session.winnerSlot;
    if (session.transcript.length > 0) {
      const replay = determinePvpOutcome(session.transcript);
      if (replay.isOver) {
        winnerSlot = replay.winnerSlot;
      }
    }

    const duel = await readOnChainDuel(BigInt(duelId));
    if (!duel || !duel.isActive) {
      return NextResponse.json({ error: "duel_not_active" }, { status: 400 });
    }
    if (duel.player2 === zeroAddress) {
      return NextResponse.json({ error: "duel_not_joined_yet" }, { status: 400 });
    }

    // If winnerSlot is null, it indicates a Draw/Tie. Map to zeroAddress.
    const winner = winnerSlot === null ? zeroAddress : winnerAddressFor(winnerSlot, duel);
    const winnerAddress = getAddress(winner as Hex);

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const duelIdBn = BigInt(duelId);

    // Single-issuance gate: only one valid signature per duel.
    if (session.resolveSignatureIssued) {
      if (session.resolveNonce && session.resolveSignature) {
        return NextResponse.json({
          duelId: duelIdBn.toString(),
          winner: winnerAddress,
          winnerSlot,
          nonce: session.resolveNonce,
          signature: session.resolveSignature,
          player1: getAddress(duel.player1 as Hex),
          player2: getAddress(duel.player2 as Hex),
        });
      }
      return NextResponse.json({ error: "resolve_already_issued" }, { status: 409 });
    }

    const redis = getRedis();
    if (redis) {
      const locked = await setNxEx(`pvp:claim:lock:${duelId}`, winnerAddress, 60 * 60);
      if (!locked) {
        return NextResponse.json({ error: "resolve_already_issued" }, { status: 409 });
      }
    }

    const nonceBytes32 = ethers.hexlify(ethers.randomBytes(32)) as Hex;

    // Chain ID for V2 cross-deployment replay protection — must match what the
    // contract reads from block.chainid (42220 on Celo mainnet).
    const chainId = process.env.DUEL_REWARDS_CHAIN_ID
      ? BigInt(process.env.DUEL_REWARDS_CHAIN_ID)
      : BigInt(42220);

    // Message encoding must match DuelRewardsV2.resolveDuel exactly.
    //
    // V1: keccak256(abi.encodePacked(duelId, winner, nonce))
    // V2: keccak256(abi.encodePacked(duelId, winner, nonce, address(this), block.chainid))
    //
    // The V2 binding to contract address + chainId prevents a signature issued
    // against a testnet deployment being replayed on mainnet V2, or against the
    // V1 contract if it still holds funds.
    const innerMessage =
      DUEL_REWARDS_VERSION === 2
        ? ethers.keccak256(
            ethers.solidityPacked(
              ["uint256", "address", "bytes32", "address", "uint256"],
              [duelIdBn, winnerAddress, nonceBytes32, DUEL_REWARDS_ADDRESS, chainId],
            ),
          )
        : ethers.keccak256(
            ethers.solidityPacked(
              ["uint256", "address", "bytes32"],
              [duelIdBn, winnerAddress, nonceBytes32],
            ),
          );
    const wallet = new ethers.Wallet(privateKey);
    const signature = await wallet.signMessage(ethers.getBytes(innerMessage));

    session.resolveSignatureIssued = true;
    session.resolveNonce = nonceBytes32;
    session.resolveSignature = signature;
    await savePvpSession(session);

    return NextResponse.json({
      duelId: duelIdBn.toString(),
      winner: winnerAddress,
      winnerSlot,
      nonce: nonceBytes32,
      signature,
      player1: getAddress(duel.player1 as Hex),
      player2: getAddress(duel.player2 as Hex),
    });
  } catch (err) {
    console.error("pvp sign-resolve:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
