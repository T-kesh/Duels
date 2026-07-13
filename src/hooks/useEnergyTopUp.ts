"use client";

import { useCallback, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { erc20Abi } from "viem";

export function useEnergyTopUp() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [status, setStatus] = useState<"idle" | "pending" | "verifying" | "done" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const treasury = (process.env.NEXT_PUBLIC_TOPUP_TREASURY || "") as `0x${string}`;
  const token = (process.env.NEXT_PUBLIC_CUSD_ADDRESS || "") as `0x${string}`;
  const weiStr = process.env.NEXT_PUBLIC_TOPUP_AMOUNT_WEI || "5000000000000000";

  const priceLabel = !process.env.NEXT_PUBLIC_TOPUP_AMOUNT_WEI
    ? "~0.005 cUSD (set NEXT_PUBLIC_TOPUP_AMOUNT_WEI)"
    : `~${Number(weiStr) / 1e18} cUSD`;

  const enabled = Boolean(walletClient && address && treasury && token);

  const buyEnergy = useCallback(async () => {
    setErrorMessage(null);
    if (!address || !walletClient || !treasury || !token) {
      setErrorMessage("Configuration error: Missing treasury or token address keys.");
      setStatus("error");
      return;
    }
    const amount = BigInt(weiStr);

    try {
      setStatus("pending");
      const txHash = await walletClient.writeContract({
        abi: erc20Abi,
        address: token,
        functionName: "transfer",
        args: [treasury, amount],
      });

      setStatus("verifying");
      const res = await fetch("/api/topup-energy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, playerAddress: address }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "verification_failed");
      }

      window.dispatchEvent(new Event("player-state-update"));
      window.dispatchEvent(new Event("energy-bonus-update"));
      setStatus("done");
    } catch (e: any) {
      console.error(e);
      setStatus("error");
      
      let msg = e?.message || String(e);
      if (msg.includes("User rejected")) {
        msg = "Transaction rejected by user.";
      } else if (msg.includes("transaction_not_found_or_failed")) {
        msg = "Transaction verify failed on RPC server. Check your network configuration.";
      }
      setErrorMessage(msg);
    } finally {
      setTimeout(() => {
        setStatus("idle");
        setErrorMessage(null);
      }, 5000);
    }
  }, [address, walletClient, treasury, token, weiStr]);

  return {
    enabled,
    priceLabel,
    buyEnergy,
    status,
    errorMessage,
  };
}
