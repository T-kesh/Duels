"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { GlowButton } from "@/components/ui/GlowButton";
import { cn } from "@/lib/utils";
import { useClaimReward } from "@/hooks/useClaimReward";
import { VictoryCelebration } from "@/components/ui/VictoryCelebration";

function ResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const { claimStatus, claimError, claimReward } = useClaimReward();

  useEffect(() => {
    if (!isConnected) {
      router.push("/");
    }
  }, [isConnected, router]);

  const won = searchParams.get("won") === "true";
  const playerHp = Number(searchParams.get("playerHp") || 0);
  const aiHp = Number(searchParams.get("aiHp") || 0);
  const duelId = searchParams.get("duelId");

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

      <div className="z-10 text-center w-full max-w-sm animate-fade-in">
        {/* Victory Celebration / Defeated UI Component */}
        <VictoryCelebration won={won} />

        <p className="text-[10px] text-muted-foreground tracking-[0.4em] uppercase mb-12 mt-3">
          {won ? "CIPHER has been neutralized" : "CIPHER maintains control"}
        </p>

        {/* Stats Summary */}
        <div className="glass border-white/5 p-6 mb-10 overflow-hidden relative">
          <div className="flex justify-around items-center relative z-10">
            <div className="text-center">
              <p className="text-[8px] text-muted-foreground tracking-widest uppercase mb-2">Final HP</p>
              <p className={cn(
                "text-3xl font-mono font-bold",
                playerHp > 0 ? "text-celo-green" : "text-destructive"
              )}>{playerHp}</p>
            </div>
            <div className="w-[1px] h-10 bg-white/10" />
            <div className="text-center">
              <p className="text-[8px] text-muted-foreground tracking-widest uppercase mb-2">Enemy HP</p>
              <p className={cn(
                "text-3xl font-mono font-bold",
                aiHp > 0 ? "text-destructive" : "text-celo-green"
              )}>{aiHp}</p>
            </div>
          </div>
        </div>

        {/* Reward Info — reflects REAL claim status, not a canned message */}
        {won && (
          <div className="bg-celo-green/5 border border-celo-green/20 rounded-2xl p-5 mb-10 animate-slide-up">
            <p className="text-[9px] text-celo-green font-bold tracking-[0.2em] uppercase mb-2">Loot Secured</p>
            <p className="text-3xl font-bold text-white mb-2">0.05 USDm</p>

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
        <div className="flex flex-col gap-4 w-full">
          <GlowButton 
            onClick={() => router.push("/game")}
            size="lg"
            className="h-14"
          >
            New Duel
          </GlowButton>

          <button
            onClick={() => {
              if (!address) {
                alert("Connect your wallet to copy your challenge link.");
                return;
              }
              const url = `${window.location.origin}/pvp?invite=${encodeURIComponent(address)}`;
              navigator.clipboard.writeText(url);
              alert("PvP duel link copied to clipboard!");
            }}
            className="glass border-white/5 bg-white/5 hover:bg-white/10 transition-all rounded-xl py-4 text-[10px] font-bold text-duel-gold tracking-[0.2em] uppercase"
          >
            ⚔️ Challenge a Friend
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
