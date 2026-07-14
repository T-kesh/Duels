"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
  useSwitchChain,
} from "wagmi";
import { useRouter, useSearchParams } from "next/navigation";
import { celo } from "viem/chains";
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

type LocalPhase =
  | "landing"    // initial — create or join
  | "creating"   // TX in flight (approve + createDuel)
  | "waiting"    // creator waiting for opponent to join
  | "joining"    // TX in flight (approve + joinDuel)
  | "auth"       // sign & play prompt
  | "playing"    // in-game
  | "done";      // game over

function PvpContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending, error: writeError } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const [wagerEther, setWagerEther] = useState("0.05");
  const [joinId, setJoinId] = useState("");
  const [activeDuelId, setActiveDuelId] = useState<string | null>(null);
  const [localPhase, setLocalPhase] = useState<LocalPhase>("landing");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const contractAt = DUEL_REWARDS_ADDRESS.toLowerCase() as Hex;
  const cusdAddr = ((params.get("cusd") || CUSD).toLowerCase() as Hex) || (`0x` as Hex);
  const tokenReady = /^0x[0-9a-fA-F]{40}$/.test(String(cusdAddr));

  // Auto-fill join ID from URL param (?join=<duelId>)
  const urlJoinId = params.get("join") ?? "";
  useEffect(() => {
    if (urlJoinId) setJoinId(urlJoinId);
  }, [urlJoinId]);

  const duelIdBn = /^[0-9]+$/.test(joinId.trim()) ? BigInt(joinId.trim()) : undefined;

  const { data: joinRowData, refetch: refetchDuel } = useReadContract({
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

  // Poll every 3s while waiting for opponent to join
  useEffect(() => {
    if (localPhase !== "waiting" || !joinId) return;
    const interval = setInterval(async () => {
      const res = await refetchDuel();
      const row = res.data as DuelRow | undefined;
      if (row && row[1] && row[1].toLowerCase() !== zeroAddress.toLowerCase()) {
        clearInterval(interval);
        setActiveDuelId(joinId);
        setLocalPhase("auth");
        setStatusMsg("Opponent joined! Sign to authenticate and begin.");
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [localPhase, joinId, refetchDuel]);

  useEffect(() => {
    if (!isConnected) router.push("/");
  }, [isConnected, router]);

  // ─── Chain-switch guard ──────────────────────────────────────────────────

  async function ensureCeloChain() {
    if (chainId !== celo.id) {
      await switchChainAsync({ chainId: celo.id });
    }
  }

  // ─── Escrow: create ──────────────────────────────────────────────────────

  const handleApproveAndCreate = async () => {
    if (!address || !tokenReady || !publicClient) return;
    try {
      await ensureCeloChain();
      setLocalPhase("creating");
      setStatusMsg(null);
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
        setJoinId(id);
        setActiveDuelId(id);
        setLocalPhase("waiting");
      } else {
        setStatusMsg("Duel created but duel ID not found in logs. Check the explorer.");
        setLocalPhase("landing");
      }
    } catch (e: unknown) {
      setLocalPhase("landing");
      setStatusMsg(`Create failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // ─── Escrow: join ────────────────────────────────────────────────────────

  const handleApproveAndJoin = async () => {
    if (!parsedJoin?.wager || !duelOpen || !tokenReady || !publicClient || duelIdBn === undefined)
      return;
    try {
      await ensureCeloChain();
      setLocalPhase("joining");
      setStatusMsg(null);
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
      setLocalPhase("auth");
      setStatusMsg("Joined! Sign to authenticate and start playing.");
    } catch (e: unknown) {
      setLocalPhase("landing");
      setStatusMsg(`Join failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // ─── Gameplay ────────────────────────────────────────────────────────────

  const { phase: gamePhase, view, error: gameError, busy, authenticate, submitCard, claimForfeit } =
    usePvpGame(activeDuelId);

  useEffect(() => {
    if (gamePhase === "playing") setLocalPhase("playing");
    if (gamePhase === "done") setLocalPhase("done");
  }, [gamePhase]);

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
    setStatusMsg(
      data.winner.toLowerCase() === address.toLowerCase()
        ? "You won — prize settled to your wallet. 🏆"
        : "Draw — funds refunded to both players.",
    );
  };

  // ─── Share link (for waiting room) ───────────────────────────────────────

  const shareDuelUrl = activeDuelId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/pvp?join=${activeDuelId}`
    : "";

  const copyShareLink = async () => {
    if (!shareDuelUrl) return;
    try {
      await navigator.clipboard.writeText(shareDuelUrl);
      setCopyToast({ ok: true, msg: "Invite link copied!" });
    } catch {
      setCopyToast({ ok: false, msg: "Copy failed — check browser permissions." });
    }
    setTimeout(() => setCopyToast(null), 3000);
  };

  const usedSet = useMemo(() => new Set(view?.usedCardIds ?? []), [view?.usedCardIds]);
  const waitingForOpponent = !!view && !view.isOver && view.youSubmitted && !view.opponentSubmitted;

  // ─────────────────────────────────────────────────────────────────────────

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

      {statusMsg && (
        <div className="glass border-duel-gold/20 rounded-xl px-4 py-3">
          <p className="text-[11px] text-duel-gold break-all leading-relaxed">{statusMsg}</p>
        </div>
      )}

      {/* ─── CREATING: TX in flight ─── */}
      {localPhase === "creating" && (
        <section className="glass border-duel-gold/10 p-8 rounded-xl flex flex-col items-center gap-5">
          <div className="w-8 h-8 border-2 border-duel-gold/20 border-t-duel-gold rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-[11px] text-duel-gold tracking-[0.3em] uppercase mb-2">Creating duel…</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed max-w-[220px]">
              Approve cUSD spend, then confirm the duel creation in your wallet.
            </p>
          </div>
        </section>
      )}

      {/* ─── WAITING: Waiting for opponent ─── */}
      {localPhase === "waiting" && activeDuelId && (
        <section className="glass border-duel-gold/10 p-6 rounded-xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-duel-gold rounded-full animate-pulse" />
            <h2 className="text-[11px] text-duel-gold tracking-[0.3em] uppercase">
              Waiting for opponent
            </h2>
          </div>

          <div className="text-center py-2">
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Duel ID</p>
            <p className="text-2xl font-bold font-mono text-white">#{activeDuelId}</p>
          </div>

          <p className="text-[10px] text-muted-foreground leading-relaxed text-center">
            Share this link — your opponent clicks it to join. The page will update automatically when they join.
          </p>

          <div className="bg-white/5 rounded-xl px-4 py-3 border border-white/5 break-all font-mono text-[9px] text-muted-foreground">
            {shareDuelUrl}
          </div>

          <GlowButton className="w-full" onClick={copyShareLink}>
            📋 Copy Invite Link
          </GlowButton>

          <div className="flex items-center justify-center gap-2 text-[9px] text-muted-foreground/50">
            <div className="w-1.5 h-1.5 bg-celo-green rounded-full animate-ping" />
            <span className="uppercase tracking-widest">Checking every 3 seconds…</span>
          </div>
        </section>
      )}

      {/* ─── JOINING: TX in flight ─── */}
      {localPhase === "joining" && (
        <section className="glass border-duel-gold/10 p-8 rounded-xl flex flex-col items-center gap-5">
          <div className="w-8 h-8 border-2 border-duel-gold/20 border-t-duel-gold rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-[11px] text-duel-gold tracking-[0.3em] uppercase mb-2">Joining duel…</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed max-w-[220px]">
              Approve cUSD wager, then confirm the join in your wallet.
            </p>
          </div>
        </section>
      )}

      {/* ─── AUTH: Sign & play prompt ─── */}
      {localPhase === "auth" && activeDuelId && (
        <section className="glass border-duel-gold/10 p-5 rounded-xl space-y-4">
          <h2 className="text-[11px] text-duel-gold tracking-[0.3em] uppercase">
            Enter duel #{activeDuelId}
          </h2>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Sign a one-time message to prove ownership of this wallet. Moves are
            server-authoritative — the winner is decided by the game engine, not self-reported.
          </p>
          <GlowButton
            className="w-full"
            disabled={busy}
            onClick={() => authenticate()}
          >
            {busy ? "Authenticating…" : "Sign & play"}
          </GlowButton>
          {gameError && <p className="text-[10px] text-destructive mt-2">{gameError}</p>}
        </section>
      )}

      {/* ─── PLAYING / DONE: Active gameplay ─── */}
      {(localPhase === "playing" || localPhase === "done") && activeDuelId && view && (
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

          {view.lastRound && (
            <p className="text-[10px] text-muted-foreground font-mono text-center">
              R{view.lastRound.round}{view.lastRound.sudden ? " (SD)" : ""}: you{" "}
              {view.lastRound.yourCard.emoji} −{view.lastRound.opponentDamageDealt} · opp{" "}
              {view.lastRound.opponentCard.emoji} −{view.lastRound.yourDamageDealt}
            </p>
          )}

          {view.isOver ? (
            <div className="space-y-3 text-center pt-2">
              <p
                className={cn(
                  "text-sm font-bold tracking-widest uppercase",
                  view.youWon === true
                    ? "text-celo-green"
                    : view.youWon === false
                    ? "text-destructive"
                    : "text-duel-gold",
                )}
              >
                {view.youWon === true ? "Victory 🏆" : view.youWon === false ? "Defeat" : "Draw"}
              </p>

              {view.youWon === true && (
                <GlowButton
                  className="w-full"
                  disabled={isPending}
                  onClick={() =>
                    handleFinalize().catch((e: unknown) =>
                      setStatusMsg(`Settle failed: ${e instanceof Error ? e.message : String(e)}`)
                    )
                  }
                >
                  Settle & claim prize
                </GlowButton>
              )}

              {view.youWon === false && (
                <p className="text-[10px] text-muted-foreground">
                  Opponent wins — waiting for them to settle on-chain.
                </p>
              )}

              {view.youWon === null && (
                <>
                  <p className="text-[10px] text-muted-foreground mb-3">
                    Draw — stakes refunded to both players.
                  </p>
                  <GlowButton
                    className="w-full"
                    disabled={isPending}
                    onClick={() =>
                      handleFinalize().catch((e: unknown) =>
                        setStatusMsg(`Settle failed: ${e instanceof Error ? e.message : String(e)}`)
                      )
                    }
                  >
                    Settle draw
                  </GlowButton>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center text-[9px] font-mono text-muted-foreground">
                <span>
                  {waitingForOpponent
                    ? "Waiting for opponent…"
                    : view.youSubmitted
                    ? "Pick locked ✓"
                    : "Choose your card"}
                </span>
                <span className={cn(secondsLeft <= 10 && "text-destructive animate-pulse")}>
                  {secondsLeft}s
                </span>
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

              {deadlinePassed && (
                <GlowButton
                  variant="outline"
                  className="w-full"
                  disabled={busy}
                  onClick={() => claimForfeit().catch(() => undefined)}
                >
                  Opponent timed out — claim win
                </GlowButton>
              )}
            </>
          )}

          {gameError && <p className="text-[10px] text-destructive">{gameError}</p>}
        </section>
      )}

      {/* ─── LANDING: Create or Join ─── */}
      {localPhase === "landing" && (
        <>
          {/* Invite link detected — show focused join UI */}
          {urlJoinId && (
            <section className="glass border-duel-gold/20 p-5 rounded-xl space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚔️</span>
                <h2 className="text-[11px] text-duel-gold tracking-[0.3em] uppercase">
                  You&apos;ve been challenged
                </h2>
              </div>

              {parsedJoin ? (
                <>
                  <div className="glass border-white/5 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Duel ID</span>
                      <span className="font-mono text-white">#{urlJoinId}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Wager</span>
                      <span className="font-mono text-duel-gold">
                        {Number(parsedJoin.wager) / 1e18} cUSD
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Status</span>
                      <span className={cn(duelOpen ? "text-celo-green" : "text-destructive")}>
                        {duelOpen ? "Open" : "Unavailable"}
                      </span>
                    </div>
                  </div>

                  {duelOpen ? (
                    <GlowButton
                      className="w-full h-12"
                      disabled={isPending || !tokenReady || !address}
                      onClick={handleApproveAndJoin}
                    >
                      Accept & join duel
                    </GlowButton>
                  ) : (
                    <p className="text-[10px] text-destructive text-center">
                      This duel is no longer open or has already started.
                    </p>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3 py-2">
                  <div className="w-4 h-4 border-2 border-duel-gold/20 border-t-duel-gold rounded-full animate-spin" />
                  <p className="text-[10px] text-muted-foreground">Loading duel #{urlJoinId}…</p>
                </div>
              )}
            </section>
          )}

          {/* Already joined but need to auth */}
          {!urlJoinId && parsedJoin && !duelOpen && parsedJoin.isActive && joinId && (
            <section className="glass border-white/5 p-4 rounded-xl">
              <GlowButton
                variant="secondary"
                className="w-full"
                disabled={duelIdBn === undefined}
                onClick={() => {
                  if (duelIdBn !== undefined) {
                    setActiveDuelId(duelIdBn.toString());
                    setLocalPhase("auth");
                  }
                }}
              >
                Resume duel #{joinId}
              </GlowButton>
            </section>
          )}

          {!tokenReady && (
            <p className="text-destructive text-xs glass border-destructive/20 p-3 rounded-xl">
              Set <code>NEXT_PUBLIC_CUSD_ADDRESS</code> to enable PvP duels.
            </p>
          )}

          {/* Create new duel */}
          <section className="glass border-white/5 p-5 rounded-xl space-y-3">
            <h2 className="text-[11px] text-duel-gold tracking-[0.3em] uppercase">Create duel</h2>
            <label className="text-[10px] text-muted-foreground uppercase tracking-widest block">
              Wager (cUSD)
            </label>
            <input
              className="w-full px-4 py-3 rounded-xl bg-duel-bg border border-duel-gold/20 font-mono text-sm text-white focus:outline-none focus:border-duel-gold/60 transition-colors"
              value={wagerEther}
              onChange={(e) => setWagerEther(e.target.value)}
            />
            <GlowButton
              disabled={isPending || !tokenReady || !address}
              className="w-full h-12"
              onClick={handleApproveAndCreate}
            >
              Approve & create
            </GlowButton>
          </section>

          {/* Manual join (only when no invite link in URL) */}
          {!urlJoinId && (
            <section className="glass border-white/5 p-5 rounded-xl space-y-3">
              <h2 className="text-[11px] text-duel-gold tracking-[0.3em] uppercase">Join by ID</h2>
              <input
                placeholder="Paste duel ID here"
                className="w-full px-4 py-3 rounded-xl bg-duel-bg border border-white/10 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-duel-gold/40 transition-colors"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
              />

              {parsedJoin && (
                <div className="bg-white/3 rounded-xl p-3 space-y-1 text-[10px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Open slot</span>
                    <span className={duelOpen ? "text-celo-green" : "text-destructive"}>
                      {duelOpen ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wager</span>
                    <span className="text-white">{Number(parsedJoin.wager) / 1e18} cUSD</span>
                  </div>
                </div>
              )}

              <GlowButton
                disabled={!duelOpen || isPending || !tokenReady || !address || duelIdBn === undefined}
                className="w-full"
                variant="outline"
                onClick={handleApproveAndJoin}
              >
                Approve wager & join
              </GlowButton>
            </section>
          )}
        </>
      )}

      {writeError && (
        <p className="text-[11px] text-destructive glass border-destructive/20 px-4 py-3 rounded-xl">
          {writeError.message}
        </p>
      )}

      {/* Clipboard toast */}
      {copyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[320px] px-4 animate-fade-in">
          <div
            className={cn(
              "rounded-2xl px-5 py-3 shadow-2xl backdrop-blur-md border flex items-center gap-3",
              copyToast.ok
                ? "bg-celo-green/90 border-celo-green/20 text-white"
                : "bg-destructive/90 border-destructive/20 text-white",
            )}
          >
            <span>{copyToast.ok ? "✓" : "⚠️"}</span>
            <p className="text-xs font-medium">{copyToast.msg}</p>
          </div>
        </div>
      )}
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
