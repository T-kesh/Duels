"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatEther } from "viem";
import { Swords } from "lucide-react";
import { GlowButton } from "@/components/ui/GlowButton";
import { cn } from "@/lib/utils";
import { useClaimReward } from "@/hooks/useClaimReward";
import { VictoryCelebration } from "@/components/ui/VictoryCelebration";
import {
  DUEL_REWARDS_ADDRESS,
  DUEL_REWARDS_ABI,
  DUEL_REWARDS_VERSION,
} from "@/constants/contracts";

/** Counts from 0 to `target` over ~0.8s, starting after `delayMs`. */
function useCountUp(target: number, delayMs: number): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target <= 0) return;
    let raf = 0;
    const DURATION = 800;
    let start: number | null = null;

    const tick = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / DURATION);
      // ease-out cubic — fast start, settles gently on the final value
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    const timer = setTimeout(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setValue(target);
        return;
      }
      raf = requestAnimationFrame(tick);
    }, delayMs);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, delayMs]);

  return value;
}

function ResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isConnected } = useAccount();
  const { claimStatus, claimError, claimedReward, claimReward } = useClaimReward();

  useEffect(() => {
    if (!isConnected) {
      router.push("/");
    }
  }, [isConnected, router]);

  const won = searchParams.get("won") === "true";
  const playerHp = Number(searchParams.get("playerHp") || 0);
  const aiHp = Number(searchParams.get("aiHp") || 0);
  const duelId = searchParams.get("duelId");

  // Stats count up once the celebration has had its moment.
  const playerHpDisplay = useCountUp(playerHp, 900);
  const aiHpDisplay = useCountUp(aiHp, 900);

  // Reward display. V1: fixed rewardAmount() from the contract. V2: CIPHER
  // decides per duel — the real amount arrives with the claim signature, so
  // until then show nothing rather than a number that might be wrong.
  const { data: rawRewardAmount } = useReadContract({
    address: DUEL_REWARDS_ADDRESS as `0x${string}`,
    abi: DUEL_REWARDS_ABI,
    functionName: "rewardAmount",
    query: { enabled: won && DUEL_REWARDS_VERSION === 1 },
  });
  const rewardLabel =
    DUEL_REWARDS_VERSION === 2
      ? claimedReward?.amountCusd
        ? `${claimedReward.amountCusd} USDm`
        : null
      : rawRewardAmount !== undefined
      ? `${formatEther(rawRewardAmount)} USDm`
      : null;

  // Fire the claim exactly once, from a page the player will actually stay
  // on long enough to approve a wallet prompt — not mid-navigation.
  const claimTriggered = useRef(false);
  useEffect(() => {
    if (won && duelId && !claimTriggered.current) {
      claimTriggered.current = true;
      claimReward(duelId);
    }
  }, [won, duelId, claimReward]);

  return (
    <main className="min-h-screen bg-duel-bg flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Glow */}
      <div className={cn(
        "fixed top-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none opacity-20",
        won ? "bg-celo-green" : "bg-destructive"
      )} />

      <div className="z-10 text-center w-full max-w-sm">
        {/* Victory Celebration / Defeated UI Component */}
        <VictoryCelebration won={won} />

        <p className="text-[10px] text-muted-foreground tracking-[0.4em] uppercase mb-12 mt-3 animate-rise-in [animation-delay:600ms]">
          {won ? "CIPHER has been neutralized" : "CIPHER maintains control"}
        </p>

        {/* Stats Summary — reveals after the celebration, HP counts up */}
        <div className="glass border-white/5 p-6 mb-10 overflow-hidden relative animate-rise-in [animation-delay:800ms]">
          <div className="flex justify-around items-center relative z-10">
            <div className="text-center">
              <p className="text-[8px] text-muted-foreground tracking-widest uppercase mb-2">Final HP</p>
              <p className={cn(
                "text-3xl font-mono font-bold tabular-nums",
                playerHp > 0 ? "text-celo-green" : "text-destructive"
              )}>{playerHpDisplay}</p>
            </div>
            <div className="w-[1px] h-10 bg-white/10" />
            <div className="text-center">
              <p className="text-[8px] text-muted-foreground tracking-widest uppercase mb-2">Enemy HP</p>
              <p className={cn(
                "text-3xl font-mono font-bold tabular-nums",
                aiHp > 0 ? "text-destructive" : "text-celo-green"
              )}>{aiHpDisplay}</p>
            </div>
          </div>
        </div>

        {/* Reward Info — reflects REAL claim status, not a canned message */}
        {won && (
          <div className="bg-celo-green/5 border border-celo-green/20 rounded-2xl p-5 mb-10 animate-rise-in [animation-delay:1100ms]">
            <p className="text-[9px] text-celo-green font-bold tracking-[0.2em] uppercase mb-2">Loot Secured</p>
            {rewardLabel ? (
              <p className={cn(
                "text-3xl font-bold mb-2 animate-count-pop",
                claimedReward?.tier === "generous" ? "text-duel-gold" : "text-white",
              )}>{rewardLabel}</p>
            ) : claimStatus === "failed" ? (
              // V2 claim failed before CIPHER priced the duel — no number to show.
              <p className="text-3xl font-bold text-white/30 mb-2">—</p>
            ) : (
              <div className="h-9 w-32 mx-auto mb-2 rounded animate-skeleton" />
            )}

            {claimedReward?.flavor && (
              <p className={cn(
                "text-[11px] italic leading-relaxed max-w-[240px] mx-auto mb-3 animate-fade-in",
                claimedReward.tier === "generous"
                  ? "text-duel-gold"
                  : claimedReward.tier === "worthy"
                  ? "text-celo-green/80"
                  : "text-muted-foreground",
              )}>
                &ldquo;{claimedReward.flavor}&rdquo;
              </p>
            )}

            {!duelId && (
              <p className="text-[10px] text-duel-gold/80 leading-relaxed max-w-[220px] mx-auto">
                Missing duel reference — reward couldn&apos;t be claimed automatically. Contact support with this result.
              </p>
            )}

            {duelId && claimStatus === "idle" && (
              <p className="text-[10px] text-muted-foreground leading-relaxed max-w-[200px] mx-auto">
                Preparing your claim…
              </p>
            )}

            {duelId && claimStatus === "claiming" && (
              <div className="flex flex-col items-center gap-2">
                <div className="w-4 h-4 border-2 border-celo-green/30 border-t-celo-green rounded-full animate-spin" />
                <p className="text-[10px] text-celo-green/70 leading-relaxed max-w-[220px] mx-auto">
                  Confirm the transaction in your wallet to claim your USDm.
                </p>
              </div>
            )}

            {duelId && claimStatus === "claimed" && (
              <p className="text-[10px] text-celo-green/70 leading-relaxed max-w-[200px] mx-auto">
                Reward sent to your connected wallet.
              </p>
            )}

            {duelId && claimStatus === "failed" && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-[10px] text-destructive leading-relaxed max-w-[220px] mx-auto">
                  Claim didn&apos;t go through. Your win is still recorded — you can retry.
                </p>
                {claimError && (
                  <p className="text-[9px] text-destructive/70 leading-relaxed max-w-[220px] mx-auto font-mono break-words">
                    {claimError}
                  </p>
                )}
                <button
                  onClick={() => claimReward(duelId)}
                  className="text-[10px] font-bold text-duel-gold hover:text-white transition-colors uppercase tracking-[0.2em] underline"
                >
                  Retry Claim
                </button>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className={cn(
          "flex flex-col gap-4 w-full animate-rise-in",
          won ? "[animation-delay:1400ms]" : "[animation-delay:1100ms]",
        )}>
          <GlowButton
            onClick={() => router.push("/game")}
            size="lg"
            className="h-14"
          >
            New Duel
          </GlowButton>

          <button
            onClick={() => router.push("/pvp")}
            className="glass border-white/5 bg-white/5 hover:bg-white/10 transition-all rounded-xl py-4 text-[10px] font-bold text-duel-gold tracking-[0.2em] uppercase inline-flex items-center justify-center gap-2"
          >
            <Swords className="w-3.5 h-3.5" />
            Challenge a Friend
          </button>
          
          <button
            onClick={() => router.push("/")}
            className="text-[10px] font-bold text-muted-foreground hover:text-white transition-colors uppercase tracking-[0.3em] py-3"
          >
            Return Home
          </button>
        </div>
      </div>
    </main>
  );
}

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-duel-bg flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-2 border-duel-gold/20 border-t-duel-gold rounded-full animate-spin" />
        </main>
      }
    >
      <ResultContent />
    </Suspense>
  );
}
