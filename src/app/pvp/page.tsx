"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { useRouter, useSearchParams } from "next/navigation";
import { erc20Abi, parseEther, zeroAddress, type Hex } from "viem";

import { DUEL_REWARDS_ABI, DUEL_REWARDS_ADDRESS } from "@/constants/contracts";
import { GlowButton } from "@/components/ui/GlowButton";
import { cn } from "@/lib/utils";

const CUSD = (typeof process.env.NEXT_PUBLIC_CUSD_ADDRESS === "string"
  ? process.env.NEXT_PUBLIC_CUSD_ADDRESS
  : "") as Hex;

function PvpContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { address, isConnected } = useAccount();
  const { writeContractAsync, data: txHash, isPending, error } = useWriteContract();

  const [wagerEther, setWagerEther] = useState("0.05");
  const [joinId, setJoinId] = useState("");
  const [resolveId, setResolveId] = useState("");

  const contractAt = DUEL_REWARDS_ADDRESS.toLowerCase() as Hex;

  const cusdAddr = ((params.get("cusd") || CUSD).toLowerCase() as Hex) || (`0x` as Hex);
  const tokenReady = /^0x[0-9a-fA-F]{40}$/.test(String(cusdAddr));

  const duelIdBn = /^[0-9]+$/.test(joinId.trim()) ? BigInt(joinId.trim()) : undefined;

  const { data: joinRowData } = useReadContract({
    address: contractAt,
    abi: DUEL_REWARDS_ABI,
    functionName: "duels",
    args: duelIdBn !== undefined ? [duelIdBn] : [BigInt(0)],
    query: { enabled: duelIdBn !== undefined && duelIdBn > BigInt(0) },
  });

  type DuelRow = [Hex, Hex, bigint, boolean];
  const joinInspect = joinRowData as DuelRow | undefined;

  const parsedJoin = useMemo(() => {
    if (!joinInspect) return null;
    return {
      p1: joinInspect[0],
      p2: joinInspect[1],
      wager: joinInspect[2],
      isActive: joinInspect[3],
    };
  }, [joinInspect]);

  const duelOpen =
    !!parsedJoin &&
    parsedJoin.isActive &&
    String(parsedJoin.p2).toLowerCase() === zeroAddress.toLowerCase();

  useEffect(() => {
    if (!isConnected) router.push("/");
  }, [isConnected, router]);

  const handleApproveAndCreate = async () => {
    if (!address || !tokenReady) return;
    const amount = parseEther(wagerEther);
    await writeContractAsync({
      address: cusdAddr,
      abi: erc20Abi,
      functionName: "approve",
      args: [contractAt as `0x${string}`, amount],
    });
    await new Promise((r) => setTimeout(r, 4_000));
    await writeContractAsync({
      address: contractAt as `0x${string}`,
      abi: DUEL_REWARDS_ABI,
      functionName: "createDuel",
      args: [amount],
    });
    alert(
      "Transactions broadcast — confirm both in wallet.\nCapture duel id via logs or explorer (incrementing nextDuelId).",
    );
  };

  const handleApproveAndJoin = async () => {
    if (!parsedJoin?.wager || !duelOpen || !tokenReady) return;
    await writeContractAsync({
      address: cusdAddr,
      abi: erc20Abi,
      functionName: "approve",
      args: [contractAt as `0x${string}`, parsedJoin.wager],
    });
    await new Promise((r) => setTimeout(r, 4_000));
    await writeContractAsync({
      address: contractAt as `0x${string}`,
      abi: DUEL_REWARDS_ABI,
      functionName: "joinDuel",
      args: [duelIdBn!],
    });
    alert("Join transaction broadcast.");
  };

  const handleFinalize = async () => {
    if (!address || !resolveId.trim()) return;
    const clean = /^[0-9]+$/.test(resolveId.trim()) ? resolveId.trim() : null;
    if (!clean) {
      alert("Enter numeric duel id");
      return;
    }
    const res = await fetch("/api/pvp/sign-resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duelId: clean, winner: address }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || res.statusText);
    }
    const { duelId: did, winner, nonce, signature } = await res.json();
    await writeContractAsync({
      address: contractAt as `0x${string}`,
      abi: DUEL_REWARDS_ABI,
      functionName: "resolveDuel",
      args: [BigInt(did), winner as Hex, nonce as Hex, signature as Hex],
    });
    alert("Resolve transaction broadcast.");
  };

  return (
    <main className="min-h-screen bg-duel-bg flex flex-col p-6 max-w-md mx-auto font-sans gap-6 pb-24">
      <header className="flex justify-between items-center">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-[10px] font-mono text-muted-foreground tracking-[0.2em]"
        >
          ← HOME
        </button>
        <span className="text-duel-gold text-xs tracking-[0.4em] font-bold">PvP ESCROW</span>
      </header>

      <p className="text-[11px] text-muted-foreground leading-relaxed glass border-white/5 p-4 rounded-xl">
        Both players escrow cUSD to{" "}
        <span className="font-mono text-duel-gold/80 break-all">{DUEL_REWARDS_ADDRESS}</span>. The backend
        must sign payouts with <code>PRIVATE_KEY</code> controlled by contract <code>owner</code>.
      </p>

      {!tokenReady ? (
        <p className="text-destructive text-xs glass border-destructive/20 p-3 rounded-xl">
          Set NEXT_PUBLIC_CUSD_ADDRESS (optional <code>?cusd=</code> query overrides for testing).
        </p>
      ) : null}

      <section className="glass border-white/5 p-5 rounded-xl space-y-3">
        <h2 className="text-[11px] text-duel-gold tracking-[0.3em] uppercase">Create duel</h2>
        <label className="text-[10px] text-muted-foreground uppercase">Wager (cUSD)</label>
        <input
          className={cn(
            "w-full px-4 py-2 rounded-xl bg-duel-bg border border-duel-gold/20 font-mono text-sm text-white",
          )}
          value={wagerEther}
          onChange={(e) => setWagerEther(e.target.value)}
        />
        <GlowButton
          disabled={isPending || !tokenReady || !address}
          className="w-full"
          onClick={() => handleApproveAndCreate().catch((e) => alert(String(e.message ?? e)))}
        >
          Approve & create
        </GlowButton>
      </section>

      <section className="glass border-white/5 p-5 rounded-xl space-y-3">
        <h2 className="text-[11px] text-duel-gold tracking-[0.3em] uppercase">Join duel</h2>
        <input
          placeholder="DUEL_ID"
          className="w-full px-4 py-2 rounded-xl bg-duel-bg border border-white/10 font-mono text-sm text-white"
          value={joinId}
          onChange={(e) => setJoinId(e.target.value)}
        />
        <div className="text-[10px] text-muted-foreground space-y-1 font-mono break-all">
          {parsedJoin && (
            <>
              <p>Open slot: {duelOpen ? "YES" : "NO"}</p>
              <p>P1:{parsedJoin.p1}</p>
              <p>P2:{parsedJoin.p2}</p>
              <p>WagerWei:{parsedJoin.wager?.toString()}</p>
            </>
          )}
        </div>
        <GlowButton
          disabled={
            !duelOpen || isPending || !tokenReady || !address || duelIdBn === undefined
          }
          className="w-full"
          variant="outline"
          onClick={() => handleApproveAndJoin().catch((e) => alert(String(e.message ?? e)))}
        >
          Approve wager & join
        </GlowButton>
      </section>

      <section className="glass border-duel-gold/10 p-5 rounded-xl space-y-3">
        <h2 className="text-[11px] text-duel-gold tracking-[0.3em] uppercase">Finalize</h2>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Winner submits their address; `/api/pvp/sign-resolve` returns operator signature consumed by{" "}
          <code className="text-[9px]">resolveDuel</code>.
        </p>
        <input
          placeholder="DUEL_ID"
          className="w-full px-4 py-2 rounded-xl bg-duel-bg border border-white/10 font-mono text-sm text-white"
          value={resolveId}
          onChange={(e) => setResolveId(e.target.value)}
        />
        <GlowButton
          className="w-full"
          variant="outline"
          disabled={!resolveId.trim() || !address}
          onClick={() => handleFinalize().catch((e) => alert(`Finalize failed: ${e.message}`))}
        >
          Sign & settle
        </GlowButton>
      </section>

      {txHash ? (
        <p className="text-[9px] text-muted-foreground break-all font-mono">Tx:{txHash}</p>
      ) : null}
      {error ? <p className="text-[11px] text-destructive">{error.message}</p> : null}
    </main>
  );
}

export default function PvpPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-duel-bg flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-2 border-duel-gold/20 border-t-duel-gold rounded-full animate-spin" />
        </main>
      }
    >
      <PvpContent />
    </Suspense>
  );
}
