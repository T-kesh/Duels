export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

import { initGameState, resolveTurn, type GameState, type AiHintType } from "@/lib/gameEngine";
import { getAiDuelSession, saveAiDuelSession } from "@/lib/duelSessionStore";
import { parsePlayerAddress } from "@/lib/addresses";
import { checkRateLimit } from "@/lib/rateLimit";
import { getRedis, setNxEx } from "@/lib/redis";
import { decideReward, formatRewardCusd } from "@/lib/rewardTiers";
import { getWinStreak } from "@/lib/playerStore";
import { DUEL_REWARDS_ADDRESS, DUEL_REWARDS_VERSION } from "@/constants/contracts";

const CLAIM_LOCK_TTL_SECONDS = 60 * 60; // matches session TTL window
const CELO_CHAIN_ID = BigInt(42220);

function claimLockKey(duelId: string) {
  return `claim:lock:${duelId}`;
}

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
      if (sessionRecord.rewardNonce && sessionRecord.rewardSignature) {
        if (DUEL_REWARDS_VERSION === 1) {
          return NextResponse.json({
            nonce: sessionRecord.rewardNonce,
            signature: sessionRecord.rewardSignature,
          });
        } else {
          const dec = sessionRecord.rewardDecision;
          const amountWei = dec ? BigInt(dec.amountWei) : BigInt(0);
          return NextResponse.json({
            nonce: sessionRecord.rewardNonce,
            signature: sessionRecord.rewardSignature,
            amountWei: amountWei.toString(),
            amountCusd: dec ? formatRewardCusd(amountWei) : "0.000",
            tier: dec?.tier ?? "base",
            flavor: dec?.flavor ?? "",
          });
        }
      }
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

    // Atomic single-issuance gate. The early `rewardSignatureIssued` check is a
    // fast-path, but two concurrent requests can both pass it before either
    // saves. A Redis SET NX lock (acquired only now that we're committed to
    // signing) guarantees exactly one signature is minted per duel across
    // serverless instances. When Redis is absent (local dev) we fall back to
    // the in-memory `rewardSignatureIssued` flag set below.
    const redis = getRedis();
    if (redis) {
      const locked = await setNxEx(claimLockKey(duelId), playerAddress, CLAIM_LOCK_TTL_SECONDS);
      if (!locked) {
        return NextResponse.json({ error: "reward_already_claimed_for_session" }, { status: 409 });
      }
    }

    const nonce = ethers.keccak256(
      ethers.solidityPacked(
        ["address", "bytes32"],
        [playerAddress, ethers.hexlify(ethers.randomBytes(32)) as `0x${string}`],
      ),
    );

    const wallet = new ethers.Wallet(privateKey);

    // V1: fixed contract-level amount; signature binds (player, nonce) only.
    if (DUEL_REWARDS_VERSION === 1) {
      const message = ethers.keccak256(
        ethers.solidityPacked(["address", "bytes32"], [playerAddress, nonce]),
      );
      const signature = await wallet.signMessage(ethers.getBytes(message));

      sessionRecord.rewardSignatureIssued = true;
      sessionRecord.rewardNonce = nonce;
      sessionRecord.rewardSignature = signature;
      await saveAiDuelSession(sessionRecord);

      return NextResponse.json({ nonce, signature });
    }

    // V2: CIPHER decides the payout from replay-verified play quality; the
    // amount is inside the signed message so the client can't inflate it,
    // and contract address + chain id prevent cross-deployment replay.
    const chainId = process.env.DUEL_REWARDS_CHAIN_ID
      ? BigInt(process.env.DUEL_REWARDS_CHAIN_ID)
      : CELO_CHAIN_ID;

    let amountWei: bigint;
    let tier: string;
    let flavor: string;

    if (sessionRecord.rewardDecision) {
      amountWei = BigInt(sessionRecord.rewardDecision.amountWei);
      tier = sessionRecord.rewardDecision.tier;
      flavor = sessionRecord.rewardDecision.flavor;
    } else {
      const streak = await getWinStreak(playerAddress);
      const reward = decideReward(replay.playerHp, streak, 100, duelId);
      amountWei = reward.amountWei;
      tier = reward.tier;
      flavor = reward.flavor;
      sessionRecord.rewardDecision = {
        tier,
        amountWei: amountWei.toString(),
        flavor,
      };
    }

    const message = ethers.keccak256(
      ethers.solidityPacked(
        ["address", "uint256", "bytes32", "address", "uint256"],
        [playerAddress, amountWei, nonce, DUEL_REWARDS_ADDRESS, chainId],
      ),
    );
    const signature = await wallet.signMessage(ethers.getBytes(message));

    sessionRecord.rewardSignatureIssued = true;
    sessionRecord.rewardNonce = nonce;
    sessionRecord.rewardSignature = signature;
    await saveAiDuelSession(sessionRecord);

    return NextResponse.json({
      nonce,
      signature,
      amountWei: amountWei.toString(),
      amountCusd: formatRewardCusd(amountWei),
      tier,
      flavor,
    });
  } catch (err) {
    console.error("claim-reward error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
