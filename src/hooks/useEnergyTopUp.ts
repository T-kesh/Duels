"use client";

import { useCallback, useState } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { erc20Abi } from "viem";

export function useEnergyTopUp() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
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

      // Wait for block inclusion on the client side before triggering backend verification
      if (publicClient) {
        await publicClient
          .waitForTransactionReceipt({ hash: txHash, timeout: 25_000 })
          .catch(() => null);
      }

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
    } catch (e: unknown) {
      console.error(e);
      setStatus("error");
      
      const errObj = e instanceof Error ? e : null;
      let msg = errObj?.message || String(e);
      if (msg.includes("User rejected") || msg.includes("user rejected") || msg.includes("UserDenied")) {
        msg = "Transaction rejected by user.";
      } else if (msg.includes("transaction_not_found_or_failed")) {
        msg = "Transaction is taking longer to confirm on Celo. Please wait a moment and try again.";
      } else if (msg.includes("transfer_mismatch_or_insufficient_amount")) {
        msg = "Top-up failed: Transferred amount or recipient did not match treasury configuration.";
      } else if (msg.includes("tx_already_consumed")) {
        msg = "This top-up transaction was already credited.";
      }
      setErrorMessage(msg);
    } finally {
      setTimeout(() => {
        setStatus("idle");
        setErrorMessage(null);
      }, 6000);
    }
  }, [address, walletClient, publicClient, treasury, token, weiStr]);

  return {
    enabled,
    priceLabel,
    buyEnergy,
    status,
    errorMessage,
  };
}
