"use client";

import { useState, useCallback } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { DUEL_REWARDS_ADDRESS, DUEL_REWARDS_ABI } from "@/constants/contracts";

export function useClaimReward() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [claimStatus, setClaimStatus] = useState<"idle" | "claiming" | "claimed" | "failed">(
    "idle",
  );

  const claimReward = useCallback(
    async (duelOrLegacy: string | null | Record<string, unknown>[]) => {
      if (!address || !walletClient) return;

      let duelId: string | undefined;
      let legacyTurns: Record<string, unknown>[] | undefined;

      if (Array.isArray(duelOrLegacy)) {
        legacyTurns = duelOrLegacy;
      } else {
        duelId = duelOrLegacy ?? undefined;
      }

      if (!duelId && !legacyTurns?.length) return;

      setClaimStatus("claiming");

      try {
        const res = await fetch("/api/claim-rewards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerAddress: address,
            duelId,
            turns: legacyTurns,
          }),
        });

        if (!res.ok) throw new Error("Failed to get reward signature");

        const { nonce, signature } = await res.json();

        const { writeContract } = await import("wagmi/actions");
        const { config } = await import("@/lib/wagmi");

        await writeContract(config, {
          address: DUEL_REWARDS_ADDRESS as `0x${string}`,
          abi: DUEL_REWARDS_ABI,
          functionName: "claimReward",
          args: [nonce, signature],
        });

        setClaimStatus("claimed");
      } catch (err) {
        console.error("Claim failed:", err);
        setClaimStatus("failed");
      }
    },
    [address, walletClient],
  );

  return {
    claimStatus,
    claimReward,
  };
}
