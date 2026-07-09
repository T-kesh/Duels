"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { useRouter, useSearchParams } from "next/navigation";
import { erc20Abi, parseEther, parseEventLogs, zeroAddress, type Hex } from "viem";

import { DUEL_REWARDS_ABI, DUEL_REWARDS_ADDRESS } from "@/constants/contracts";
import { GlowButton } from "@/components/ui/GlowButton";
import { HpBar } from "@/components/ui/HpBar";
import { CardTile } from "@/components/ui/CardTile";
import { cn } from "@/lib/utils";
import { usePvpGame } from "@/hooks/usePvpGame";

const CUSD = (typeof process.env.NEXT_PUBLIC_CUSD_ADDRESS === "string"
  ? process.env.NEXT_PUBLIC_CUSD_ADDRESS
  : "") as Hex;

function PvpContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending, error } = useWriteContract();

  const [wagerEther, setWagerEther] = useState("0.05");
  const [joinId, setJoinId] = useState("");
  const [activeDuelId, setActiveDuelId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  // ─── Escrow: create / join ────────────────────────────────────────────────

  const handleApproveAndCreate = async () => {
    if (!address || !tokenReady || !publicClient) return;
    const amount = parseEther(wagerEther);
    await writeContractAsync({
      address: cusdAddr,
      abi: erc20Abi,
      functionName: "approve",
      args: [contractAt as `0x${string}`, amount],
    });
    const txHash = await writeContractAsync({
      address: contractAt as `0x${string}`,
      abi: DUEL_REWARDS_ABI,
      functionName: "createDuel",
      args: [amount],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    const logs = parseEventLogs({
      abi: DUEL_REWARDS_ABI,
      eventName: "DuelCreated",
      logs: receipt.logs,
    });
    const created = logs[0]?.args as { duelId?: bigint } | undefined;
    if (created?.duelId !== undefined) {
      const id = created.duelId.toString();
      setActiveDuelId(id);
      setJoinId(id);
      setNotice(`Duel #${id} created — share this id with your opponent to join.`);
    } else {
      setNotice("Duel created, but could not read the duel id from logs. Check the explorer.");
    }
  };

  const handleApproveAndJoin = async () => {
    if (!parsedJoin?.wager || !duelOpen || !tokenReady || !publicClient || duelIdBn === undefined)
      return;
    await writeContractAsync({
      address: cusdAddr,
      abi: erc20Abi,
      functionName: "approve",
      args: [contractAt as `0x${string}`, parsedJoin.wager],
    });
    const txHash = await writeContractAsync({
      address: contractAt as `0x${string}`,
      abi: DUEL_REWARDS_ABI,
      functionName: "joinDuel",
      args: [duelIdBn],
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    setActiveDuelId(duelIdBn.toString());
    setNotice(`Joined duel #${duelIdBn.toString()} — authenticate to start playing.`);
  };

  // ─── Gameplay ───────────────────────────────────────────────────────────────

  const { phase, view, error: gameError, busy, authenticate, submitCard, claimForfeit } =
    usePvpGame(activeDuelId);

  const [now, setNow] = useState(() => 0);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const deadlinePassed = !!view && !view.isOver && now > 0 && now > view.roundDeadlineMs;
  const secondsLeft =
    view && !view.isOver ? Math.max(0, Math.ceil((view.roundDeadlineMs - now) / 1000)) : 0;

  const handleFinalize = async () => {
    if (!activeDuelId || !address) return;
    const res = await fetch("/api/pvp/sign-resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-player-address": address },
      body: JSON.stringify({ duelId: activeDuelId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    await writeContractAsync({
      address: contractAt as `0x${string}`,
      abi: DUEL_REWARDS_ABI,
      functionName: "resolveDuel",
      args: [BigInt(data.duelId), data.winner as Hex, data.nonce as Hex, data.signature as Hex],
    });
    setNotice(
      data.winner.toLowerCase() === address.toLowerCase()
        ? "You won — prize settled to your wallet."
        : "Settled. The winner has been paid out.",
    );
  };

  const usedSet = useMemo(() => new Set(view?.usedCardIds ?? []), [view?.usedCardIds]);
  const waitingForOpponent = !!view && !view.isOver && view.youSubmitted && !view.opponentSubmitted;

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
        <span className="text-duel-gold text-xs tracking-[0.4em] font-bold">PvP DUEL</span>
      </header>

      {notice ? (
        <p className="text-[11px] text-celo-green glass border-celo-green/20 p-3 rounded-xl break-all">
          {notice}
        </p>
      ) : null}

      {/* ─── Active gameplay ─── */}
      {activeDuelId && phase !== "idle" && view ? (
        <section className="glass border-duel-gold/10 p-5 rounded-xl space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-[11px] text-duel-gold tracking-[0.3em] uppercase">
              Duel #{activeDuelId}
            </h2>
            <span className="text-[9px] font-mono text-muted-foreground">
              {view.isOver ? "COMPLETE" : `ROUND ${view.round}`}
            </span>
          </div>

          <div className="flex gap-4">
            <HpBar hp={view.yourHp} label="YOU" />
            <div className="w-[1px] bg-white/5 self-stretch" />
            <HpBar hp={view.opponentHp} label="OPPONENT" />
          </div>

          {view.lastRound ? (
            <p className="text-[10px] text-muted-foreground font-mono text-center">
              R{view.lastRound.round}{view.lastRound.sudden ? " (SD)" : ""}: you{" "}
              {view.lastRound.yourCard.emoji} −{view.lastRound.opponentDamageDealt} · opp{" "}
              {view.lastRound.opponentCard.emoji} −{view.lastRound.yourDamageDealt}
            </p>
          ) : null}

          {view.isOver ? (
            <div className="space-y-3 text-center">
              <p
                className={cn(
                  "text-sm font-bold tracking-widest uppercase",
                  view.youWon ? "text-celo-green" : "text-destructive",
                )}
              >
                {view.youWon ? "Victory" : "Defeat"}
              </p>
              <GlowButton
                className="w-full"
                disabled={isPending}
                onClick={() => handleFinalize().catch((e) => setNotice(`Finalize failed: ${e.message}`))}
              >
                {view.youWon ? "Settle & claim prize" : "Settle duel"}
              </GlowButton>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center text-[9px] font-mono text-muted-foreground">
                <span>
                  {waitingForOpponent
                    ? "Waiting for opponent…"
                    : view.youSubmitted
                    ? "Pick locked"
                    : "Choose your card"}
                </span>
                <span className={cn(secondsLeft <= 10 && "text-destructive")}>{secondsLeft}s</span>
              </div>

              <div className="flex gap-3 h-36">
                {view.yourHand.map((card) => (
                  <CardTile
                    key={card.id}
                    card={card}
                    used={usedSet.has(card.id)}
                    disabled={busy || view.youSubmitted || waitingForOpponent}
                    onClick={() => submitCard(card.id)}
                  />
                ))}
              </div>

              {deadlinePassed ? (
                <GlowButton
                  variant="outline"
                  className="w-full"
                  disabled={busy}
                  onClick={() => claimForfeit().catch(() => undefined)}
                >
                  Opponent timed out — claim win
                </GlowButton>
              ) : null}
            </>
          )}

          {gameError ? <p className="text-[10px] text-destructive">{gameError}</p> : null}
        </section>
      ) : null}

      {/* ─── Authenticate to play ─── */}
      {activeDuelId && phase === "idle" ? (
        <section className="glass border-duel-gold/10 p-5 rounded-xl space-y-3">
          <h2 className="text-[11px] text-duel-gold tracking-[0.3em] uppercase">
            Enter duel #{activeDuelId}
          </h2>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Sign a one-time message to prove this wallet, then play. Moves are server-authoritative —
            the winner is decided by the game, not self-reported.
          </p>
          <GlowButton
            className="w-full"
            disabled={busy}
            onClick={() => authenticate()}
          >
            {busy ? "Authenticating…" : "Sign & play"}
          </GlowButton>
          {gameError ? <p className="text-[10px] text-destructive">{gameError}</p> : null}
        </section>
      ) : null}

      {!tokenReady ? (
        <p className="text-destructive text-xs glass border-destructive/20 p-3 rounded-xl">
          Set NEXT_PUBLIC_CUSD_ADDRESS (optional <code>?cusd=</code> query overrides for testing).
        </p>
      ) : null}

      {/* ─── Create ─── */}
      <section className="glass border-white/5 p-5 rounded-xl space-y-3">
        <h2 className="text-[11px] text-duel-gold tracking-[0.3em] uppercase">Create duel</h2>
        <label className="text-[10px] text-muted-foreground uppercase">Wager (USDm)</label>
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
          onClick={() => handleApproveAndCreate().catch((e) => setNotice(String(e.message ?? e)))}
        >
          Approve & create
        </GlowButton>
      </section>

      {/* ─── Join ─── */}
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
          disabled={!duelOpen || isPending || !tokenReady || !address || duelIdBn === undefined}
          className="w-full"
          variant="outline"
          onClick={() => handleApproveAndJoin().catch((e) => setNotice(String(e.message ?? e)))}
        >
          Approve wager & join
        </GlowButton>
        {parsedJoin && !duelOpen && parsedJoin.isActive ? (
          <GlowButton
            variant="secondary"
            className="w-full"
            disabled={duelIdBn === undefined}
            onClick={() => {
              if (duelIdBn !== undefined) setActiveDuelId(duelIdBn.toString());
            }}
          >
            Play this duel
          </GlowButton>
        ) : null}
      </section>

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
