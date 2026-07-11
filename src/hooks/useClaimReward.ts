"use client";

import { useState, useCallback, useRef } from "react";
import { useAccount, useWriteContract, useSwitchChain } from "wagmi";
import { celo } from "wagmi/chains";
import { DUEL_REWARDS_ADDRESS, DUEL_REWARDS_ABI } from "@/constants/contracts";

export function useClaimReward() {
  const { address, status: accountStatus, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const [claimStatus, setClaimStatus] = useState<"idle" | "claiming" | "claimed" | "failed">(
    "idle",
  );
  const [claimError, setClaimError] = useState<string | null>(null);

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

    // Give address a short grace window instead of bailing out with no feedback
    let addr = addressRef.current;
    for (let attempt = 0; attempt < 10 && !addr; attempt++) {
      await new Promise((r) => setTimeout(r, 300));
      addr = addressRef.current;
    }
    if (!addr) {
      console.error("claimReward: wallet address never became available");
      setClaimStatus("failed");
      setClaimError("Wallet address is not available.");
      return;
    }

    try {
      // Chain ID Mismatch Guard
      if (chainId !== celo.id) {
        try {
          await switchChainAsync({ chainId: celo.id });
        } catch (switchErr: any) {
          throw new Error(`Please switch to Celo network: ${switchErr?.message || switchErr}`);
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

      const { nonce, signature } = await res.json();

      await writeContractAsync({
        address: DUEL_REWARDS_ADDRESS as `0x${string}`,
        abi: DUEL_REWARDS_ABI,
        functionName: "claimReward",
        args: [nonce, signature],
      });

      setClaimStatus("claimed");
    } catch (err: any) {
      console.error("Claim failed:", err);
      setClaimStatus("failed");

      // Extract detailed failure reasons
      let message = err?.message || String(err);
      if (err?.cause?.message) {
        message = err.cause.message;
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
    claimReward,
  };
}
