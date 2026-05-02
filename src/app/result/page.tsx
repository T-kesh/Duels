"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useAccount } from "wagmi";
import { GlowButton } from "@/components/ui/GlowButton";
import { cn } from "@/lib/utils";

function ResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (!isConnected) {
      router.push("/");
    }
  }, [isConnected, router]);

  const won = searchParams.get("won") === "true";
  const playerHp = Number(searchParams.get("playerHp") || 0);
  const aiHp = Number(searchParams.get("aiHp") || 0);
  const claimState = searchParams.get("claim") || "none";

  return (
    <main className="min-h-screen bg-duel-bg flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Glow */}
      <div className={cn(
        "fixed top-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none opacity-20",
        won ? "bg-celo-green" : "bg-destructive"
      )} />

      <div className="z-10 text-center w-full max-w-sm animate-fade-in">
        {/* Status Icon */}
        <div className="relative inline-block mb-8">
          <span className={cn(
            "text-8xl block animate-float filter drop-shadow-2xl",
            won ? "drop-shadow-[0_0_30px_rgba(53,212,106,0.4)]" : "drop-shadow-[0_0_30px_rgba(255,77,79,0.3)]"
          )}>
            {won ? "🏆" : "💀"}
          </span>
        </div>

        {/* Status Text */}
        <h1 className={cn(
          "text-5xl font-bold tracking-[0.2em] mb-3 uppercase",
          won ? "text-celo-green" : "text-destructive"
        )}>
          {won ? "Victory" : "Defeated"}
        </h1>
        <p className="text-[10px] text-muted-foreground tracking-[0.4em] uppercase mb-12">
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

        {/* Reward Info */}
        {won && (
          <div className="bg-celo-green/5 border border-celo-green/20 rounded-2xl p-5 mb-10 animate-slide-up">
            <p className="text-[9px] text-celo-green font-bold tracking-[0.2em] uppercase mb-2">Loot Secured</p>
            <p className="text-3xl font-bold text-white mb-2">0.05 cUSD</p>
            <p className="text-[10px] text-celo-green/70 leading-relaxed max-w-[200px] mx-auto">
              Transfer initiated to your connected MiniPay wallet.
            </p>
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
              const url = `${window.location.origin}/?challenger=${address}`;
              navigator.clipboard.writeText(url);
              alert("Challenge link copied to clipboard!");
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
    <Suspense fallback={
      <main className="min-h-screen bg-duel-bg flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-2 border-duel-gold/20 border-t-duel-gold rounded-full animate-spin" />
      </div>
    }>
      <ResultContent />
    </Suspense>
  );
}
