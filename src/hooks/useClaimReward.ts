"use client";

import { useState, useCallback, useRef } from "react";
import { useAccount, useWalletClient, useSwitchChain } from "wagmi";
import { celo } from "wagmi/chains";
import { DUEL_REWARDS_ADDRESS, DUEL_REWARDS_ABI } from "@/constants/contracts";

export function useClaimReward() {
  const { address, connector, status: accountStatus, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const addressRef = useRef(address);
  addressRef.current = address;

  const {
    data: walletClient,
    error: walletClientError,
    status: walletClientStatus,
  } = useWalletClient();
  const walletClientRef = useRef(walletClient);
  walletClientRef.current = walletClient;
  const walletClientErrorRef = useRef(walletClientError);
  walletClientErrorRef.current = walletClientError;
  const walletClientStatusRef = useRef(walletClientStatus);
  walletClientStatusRef.current = walletClientStatus;

  const [claimStatus, setClaimStatus] = useState<"idle" | "claiming" | "claimed" | "failed">(
    "idle",
  );

  const claimReward = useCallback(async (duelId: string | null) => {
    if (!duelId) {
      console.error("claimReward: missing duelId, cannot claim");
      setClaimStatus("failed");
      return;
    }

    // Set this immediately, before any waiting — a silent "idle" with no
    // path forward is what caused this bug in the first place.
    setClaimStatus("claiming");

    // Both `address` and `walletClient` can be briefly undefined right after
    // navigating to this page while wagmi rehydrates the connector. Give
    // both a short grace window instead of bailing out with no feedback.
    let addr = addressRef.current;
    for (let attempt = 0; attempt < 10 && !addr; attempt++) {
      await new Promise((r) => setTimeout(r, 300));
      addr = addressRef.current;
    }
    if (!addr) {
      console.error("claimReward: wallet address never became available");
      setClaimStatus("failed");
      return;
    }

    let client = walletClientRef.current;
    for (let attempt = 0; attempt < 10 && !client; attempt++) {
      await new Promise((r) => setTimeout(r, 300));
      client = walletClientRef.current;
    }
    if (!client) {
      // Full diagnostic snapshot — "error: null" alone doesn't tell us why;
      // whether wagmi even thinks a wallet is connected, which connector,
      // and what chain it's tracking does.
      console.error("claimReward: wallet client never became available.", {
        accountStatus,
        connectorName: connector?.name,
        connectorId: connector?.id,
        chainId,
        address: addressRef.current,
        walletClientStatus: walletClientStatusRef.current,
        walletClientError: walletClientErrorRef.current,
      });
      setClaimStatus("failed");
      return;
    }

    try {
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
        throw new Error(payload.error ?? "Failed to get reward signature");
      }

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
  }, [connector, accountStatus, chainId]);

  return {
    claimStatus,
    claimReward,
  };
}

