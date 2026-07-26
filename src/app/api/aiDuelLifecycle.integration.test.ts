import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { ethers } from "ethers";
import type { Card } from "@/constants/cards";

import { POST as handleChallenge } from "@/app/api/start-duel/challenge/route";
import { POST as handleStartDuel } from "@/app/api/start-duel/route";
import { POST as handleConfirmHand } from "@/app/api/confirm-hand/route";
import { POST as handleAiMove } from "@/app/api/ai-move/route";
import { POST as handleClaimRewards } from "@/app/api/claim-rewards/route";

const TEST_PRIVATE_KEY = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function createNextRequest(url: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("AI Duel E2E Lifecycle Integration Test", () => {
  let wallet: ethers.Wallet;
  let playerAddress: string;

  beforeAll(() => {
    process.env.PRIVATE_KEY = TEST_PRIVATE_KEY;
    process.env.DUEL_REWARDS_ADDRESS = "0x1111111111111111111111111111111111111111";
    process.env.CUSD_TOKEN_ADDRESS = "0x2222222222222222222222222222222222222222";
    process.env.DUEL_REWARDS_VERSION = "2";
    process.env.NEXT_PUBLIC_DUEL_REWARDS_VERSION = "2";

    wallet = new ethers.Wallet(TEST_PRIVATE_KEY);
    playerAddress = wallet.address;
  });

  it("completes full AI duel loop: challenge -> start-duel -> confirm-hand -> 3 turns -> claim rewards", async () => {
    // ── Phase 1: Request Challenge Nonce & Message ───────────────────────────
    const challengeReq = createNextRequest("http://localhost:3000/api/start-duel/challenge", {
      address: playerAddress,
    });
    const challengeRes = await handleChallenge(challengeReq);
    expect(challengeRes.status).toBe(200);

    const challengePayload = await challengeRes.json();
    expect(challengePayload.nonce).toBeDefined();
    expect(challengePayload.message).toContain("authenticate to start an AI duel");

    // ── Phase 2: Sign Challenge Proof & Start Duel ───────────────────────────
    const signature = await wallet.signMessage(challengePayload.message);

    const startReq = createNextRequest("http://localhost:3000/api/start-duel", {
      playerAddress,
      signature,
    });
    const startRes = await handleStartDuel(startReq);
    expect(startRes.status).toBe(200);

    const startPayload = await startRes.json();
    expect(startPayload.duelId).toBeDefined();
    expect(startPayload.dealtPool).toHaveLength(6);
    expect(startPayload.aiHintType).toBeDefined();

    const duelId: string = startPayload.duelId;
    const dealtPool: Card[] = startPayload.dealtPool;

    // ── Phase 3: Pick 3 Cards from Dealt Pool & Confirm Hand ────────────────
    const pickedCardIds = dealtPool.slice(0, 3).map((c) => c.id);
    const confirmReq = createNextRequest("http://localhost:3000/api/confirm-hand", {
      duelId,
      pickedCardIds,
    });
    const confirmRes = await handleConfirmHand(confirmReq);
    expect(confirmRes.status).toBe(200);

    const confirmPayload = await confirmRes.json();
    expect(confirmPayload.hand).toHaveLength(3);
    const hand: Card[] = confirmPayload.hand;

    // ── Phase 4: Play 3 Turns Sequential Moves ──────────────────────────────
    let finalState: { isOver: boolean; playerWon: boolean | null } | null = null;

    for (let turn = 1; turn <= 3; turn++) {
      const cardToPlay = hand[turn - 1];

      const moveReq = createNextRequest("http://localhost:3000/api/ai-move", {
        duelId,
        playerCard: cardToPlay,
      });

      const moveRes = await handleAiMove(moveReq);
      expect(moveRes.status).toBe(200);

      const movePayload = await moveRes.json();
      expect(movePayload.card).toBeDefined();
      expect(movePayload.reasoning).toBeDefined();
      expect(movePayload.state).toBeDefined();
      expect(movePayload.state.turn).toBe(turn + 1);

      if (turn < 3) {
        expect(movePayload.state.isOver).toBe(false);
        expect(movePayload.nextAiHintType).toBeDefined();
      } else {
        expect(movePayload.state.isOver).toBe(true);
        expect(movePayload.state.playerWon).not.toBeNull();
        finalState = movePayload.state;
      }
    }

    expect(finalState?.isOver).toBe(true);

    // ── Phase 5: Claim Rewards (If Player Won) ──────────────────────────────
    if (finalState?.playerWon) {
      const claimReq = createNextRequest("http://localhost:3000/api/claim-rewards", {
        playerAddress,
        duelId,
      });

      const claimRes = await handleClaimRewards(claimReq);
      expect(claimRes.status).toBe(200);

      const claimPayload = await claimRes.json();
      expect(claimPayload.nonce).toBeDefined();
      expect(claimPayload.signature).toBeDefined();
      expect(claimPayload.amountWei).toBeDefined();
      expect(claimPayload.amountCusd).toBeDefined();
      expect(claimPayload.tier).toBeDefined();
      expect(claimPayload.expiresAtMs).toBeGreaterThan(Date.now());

      // Verify EIP-712 reward signature is signed by test server private key
      const expectedChainId = BigInt(42220);
      const innerMessage = ethers.keccak256(
        ethers.solidityPacked(
          ["address", "uint256", "bytes32", "address", "uint256"],
          [
            playerAddress,
            BigInt(claimPayload.amountWei),
            claimPayload.nonce,
            process.env.DUEL_REWARDS_ADDRESS,
            expectedChainId,
          ],
        ),
      );

      const recoveredAddress = ethers.verifyMessage(
        ethers.getBytes(innerMessage),
        claimPayload.signature,
      );
      const expectedServerSigner = new ethers.Wallet(process.env.PRIVATE_KEY!).address;
      expect(recoveredAddress.toLowerCase()).toBe(expectedServerSigner.toLowerCase());

      // Re-claiming the same session returns cached signature (dupe-issuance protection)
      const reClaimRes = await handleClaimRewards(claimReq);
      expect(reClaimRes.status).toBe(200);
      const reClaimPayload = await reClaimRes.json();
      expect(reClaimPayload.signature).toBe(claimPayload.signature);
    }
  });
});
