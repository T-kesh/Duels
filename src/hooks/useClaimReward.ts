"use client";

import { useState, useCallback, useRef } from "react";
import { useAccount, useWriteContract, useSwitchChain } from "wagmi";
import { celo } from "wagmi/chains";
import {
  DUEL_REWARDS_ADDRESS,
  DUEL_REWARDS_ABI,
  DUEL_REWARDS_V2_ABI,
  DUEL_REWARDS_VERSION,
} from "@/constants/contracts";

export interface ClaimedReward {
  /** Formatted cUSD amount, e.g. "0.008" (V2 only; null on V1). */
  amountCusd: string | null;
  /** CIPHER's payout tier (V2 only). */
  tier: "base" | "worthy" | "generous" | null;
  /** CIPHER's voice line for the payout (V2 only). */
  flavor: string | null;
}

export function useClaimReward() {
  const { address, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const [claimStatus, setClaimStatus] = useState<"idle" | "claiming" | "claimed" | "failed">(
    "idle",
  );
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimedReward, setClaimedReward] = useState<ClaimedReward | null>(null);

  const addressRef = useRef(address);
  addressRef.current = address;

  const claimReward = useCallback(async (duelId: string | null) => {
    if (!duelId) {
      console.error("claimReward: missing duelId, cannot claim");
      setClaimStatus("failed");
      setClaimError("Missing duelId reference.");
      return;
    }

    setClaimStatus("claiming");
    setClaimError(null);

    const addr = addressRef.current;
    if (!addr) {
      console.error("claimReward: wallet address is not available");
      setClaimStatus("failed");
      setClaimError("Wallet address is not available. Please connect your wallet.");
      return;
    }

    try {
      // Chain ID Mismatch Guard
      if (chainId !== celo.id) {
        try {
          await switchChainAsync({ chainId: celo.id });
        } catch (switchErr: unknown) {
          const msg = switchErr instanceof Error ? switchErr.message : String(switchErr);
          throw new Error(`Please switch to Celo network: ${msg}`);
        }
      }

      const res = await fetch("/api/claim-rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerAddress: addr,
          duelId,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to get reward signature from server.");
      }

      const payload = await res.json();
      const { nonce, signature } = payload;

      if (DUEL_REWARDS_VERSION === 2) {
        // V2: the signed amount must be submitted verbatim — the contract
        // rejects any other value.
        const amountWei = BigInt(payload.amountWei);
        setClaimedReward({
          amountCusd: payload.amountCusd ?? null,
          tier: payload.tier ?? null,
          flavor: payload.flavor ?? null,
        });

        await writeContractAsync({
          address: DUEL_REWARDS_ADDRESS as `0x${string}`,
          abi: DUEL_REWARDS_V2_ABI,
          functionName: "claimReward",
          args: [amountWei, nonce, signature],
        });
      } else {
        await writeContractAsync({
          address: DUEL_REWARDS_ADDRESS as `0x${string}`,
          abi: DUEL_REWARDS_ABI,
          functionName: "claimReward",
          args: [nonce, signature],
        });
      }

      setClaimStatus("claimed");
    } catch (err: unknown) {
      console.error("Claim failed:", err);
      setClaimStatus("failed");

      // Extract detailed failure reasons
      const errObj = err instanceof Error ? err : null;
      
      // Safe extraction of cause without explicit 'any' cast
      let causeMessage: string | null = null;
      if (errObj && "cause" in errObj && errObj.cause && typeof errObj.cause === "object" && "message" in errObj.cause) {
        causeMessage = String((errObj.cause as { message: unknown }).message);
      }

      let message = errObj?.message || String(err);
      if (causeMessage) {
        message = causeMessage;
      }

      if (message.includes("User rejected the request")) {
        message = "Transaction rejected by user.";
      } else if (message.includes("PoolEmpty") || message.includes("0xe5ea1016")) {
        message = "Contract reward pool is empty. Please contact support.";
      } else if (message.includes("DailyLimitReached") || message.includes("0xc4506c04")) {
        message = "Daily claim limit reached.";
      }

      setClaimError(message);
    }
  }, [chainId, writeContractAsync, switchChainAsync]);

  return {
    claimStatus,
    claimError,
    claimedReward,
    claimReward,
  };
}
