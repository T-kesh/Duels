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

  const treasury = (process.env.NEXT_PUBLIC_TOPUP_TREASURY || "") as `0x${string}`;
  const token = (process.env.NEXT_PUBLIC_CUSD_ADDRESS || "") as `0x${string}`;
  const weiStr = process.env.NEXT_PUBLIC_TOPUP_AMOUNT_WEI || "5000000000000000";

  const priceLabel = !process.env.NEXT_PUBLIC_TOPUP_AMOUNT_WEI
    ? "~0.005 cUSD (set NEXT_PUBLIC_TOPUP_AMOUNT_WEI)"
    : `~${Number(weiStr) / 1e18} cUSD`;

  const enabled = Boolean(walletClient && address && treasury && token);

  const buyEnergy = useCallback(async () => {
    if (!address || !walletClient || !treasury || !token) {
      alert("Set NEXT_PUBLIC_TOPUP_TREASURY and NEXT_PUBLIC_CUSD_ADDRESS in .env.local.");
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

      const payload = await res.json();
      const grant = typeof payload?.bonusGrant === "number" ? payload.bonusGrant : 1;
      try {
        const cur = parseInt(localStorage.getItem("duel_bonus_lives") ?? "0", 10);
        const next = Number.isFinite(cur) ? cur + grant : grant;
        localStorage.setItem("duel_bonus_lives", `${next}`);
      } catch {
        // ignore quota issues
      }

      window.dispatchEvent(new Event("energy-bonus-update"));
      setStatus("done");
    } catch (e) {
      console.error(e);
      setStatus("error");
      alert(`Top-up failed: ${String((e as Error)?.message ?? e)}`);
    } finally {
      setTimeout(() => setStatus("idle"), 2000);
    }
  }, [address, walletClient, treasury, token, weiStr]);

  return {
    enabled,
    priceLabel,
    buyEnergy,
    status,
  };
}
