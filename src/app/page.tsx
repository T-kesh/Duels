"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@/components/connect-button";
import { GlowButton } from "@/components/ui/GlowButton";

export default function Home() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const s = parseInt(localStorage.getItem('duel_streak') || '0');
    setStreak(s);
  }, []);

  return (
    <main className="min-h-screen bg-duel-bg flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Glow */}
      <div className="fixed top-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-duel-gold/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="z-10 text-center w-full max-w-sm animate-fade-in">
        {/* Logo/Icon */}
        <div className="relative inline-block mb-6">
          <span className="text-7xl block animate-float filter drop-shadow-[0_0_20px_rgba(252,196,25,0.4)]">
            ⚔️
          </span>
        </div>

        {/* Title */}
        <h1 className="text-6xl font-bold text-duel-gold tracking-[0.15em] mb-2 drop-shadow-[0_0_30px_rgba(252,196,25,0.3)] uppercase">
          Duel
        </h1>
        <p className="text-[10px] text-muted-foreground tracking-[0.5em] uppercase mb-10">
          AI Card Battle • Earn cUSD
        </p>

        {/* Win Streak Badge */}
        {streak > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2 glass border-duel-gold/20 rounded-full mb-10 animate-pulse">
            <span className="text-lg">🔥</span>
            <span className="text-xs font-bold text-duel-gold tracking-widest uppercase">
              {streak} Win Streak
            </span>
          </div>
        )}

        {/* How to Play Card */}
        <div className="glass border-white/5 p-6 mb-10 text-left relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-duel-gold/50" />
          <h3 className="text-[10px] font-bold text-duel-gold tracking-widest uppercase mb-4">Initial Intel</h3>
          <ul className="space-y-3">
            {[
              "Deploy 1 card per turn",
              "Outlast CIPHER over 3 turns",
              "End with higher HP to win",
              "Successful duels earn cUSD"
            ].map((step, i) => (
              <li key={i} className="flex gap-4 items-start">
                <span className="font-mono text-duel-gold/40 text-xs">0{i + 1}</span>
                <span className="text-xs text-muted-foreground leading-relaxed">{step}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-4 items-center w-full">
          {isConnected ? (
            <>
              <GlowButton 
                onClick={() => router.push("/game")}
                size="lg"
                className="w-full h-14"
              >
                Enter Arena
              </GlowButton>
              
              <button
                onClick={() => router.push("/leaderboard")}
                className="text-[10px] font-bold text-muted-foreground hover:text-white transition-colors uppercase tracking-[0.3em] py-2"
              >
                🏆 Hall of Fame
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-6 w-full">
              <p className="text-xs text-muted-foreground animate-pulse">Authorize via MiniPay to begin</p>
              <ConnectButton />
            </div>
          )}
        </div>

        {/* Footer info */}
        <footer className="mt-16">
          <p className="text-[9px] text-white/10 tracking-[0.4em] font-mono uppercase">
            Protocol: Celo • Proof of Ship
          </p>
        </footer>
      </div>
    </main>
  );
}