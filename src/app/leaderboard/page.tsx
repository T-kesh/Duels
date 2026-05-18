"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useReadContract } from "wagmi";
import { cn } from "@/lib/utils";
import { DUEL_REWARDS_ADDRESS, DUEL_REWARDS_ABI } from "@/constants/contracts";

interface LeaderboardEntry {
  rank: number;
  address: string;
  wins: number;
}

const RANK_EMOJI: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

export default function LeaderboardPage() {
  const router = useRouter();
  const [playerWins, setPlayerWins] = useState(0);
  const [playerStreak, setPlayerStreak] = useState(0);

  const { data: leaderboardData, isLoading: loading } = useReadContract({
    address: DUEL_REWARDS_ADDRESS as `0x${string}`,
    abi: DUEL_REWARDS_ABI,
    functionName: "getLeaderboard",
  });

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const wins = parseInt(localStorage.getItem("duel_total_wins") || "0");
    const streak = parseInt(localStorage.getItem("duel_streak") || "0");
    setPlayerWins(wins);
    setPlayerStreak(streak);

    if (leaderboardData) {
      const [addrs, winsArr] = leaderboardData as [string[], bigint[]];
      const formattedEntries = addrs.map((addr, i) => ({
        rank: i + 1,
        address: addr,
        wins: Number(winsArr[i]),
      }));
      setEntries(formattedEntries.filter((e) => e.wins > 0));
    }
  }, [leaderboardData]);

  return (
    <main className="min-h-screen bg-duel-bg flex flex-col px-4 py-5 max-w-[420px] mx-auto font-sans">
      <div className="flex justify-between items-center mb-6">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="bg-transparent border-0 p-0 cursor-pointer text-xs font-mono text-muted-foreground tracking-[0.2em] hover:text-white uppercase"
        >
          ← BACK
        </button>
        <span className="text-sm font-black text-duel-gold tracking-[0.25em]">LEADERBOARD</span>
        <span className="w-[52px]" />
      </div>

      <div
        className={cn(
          "rounded-xl p-4 mb-6 flex justify-around gap-4",
          "bg-duel-gold/[0.05] border border-duel-gold/15",
        )}
      >
        <div className="text-center flex-1">
          <p className="text-[9px] text-muted-foreground tracking-[0.2em] uppercase mb-1">
            LOCAL WINS
          </p>
          <p className="text-2xl font-black text-duel-gold tabular-nums">{playerWins}</p>
          <p className="text-[8px] text-muted-foreground/80 mt-0.5">Off-chain profile</p>
        </div>
        <div className="w-px bg-white/10 self-stretch min-h-[48px]" />
        <div className="text-center flex-1">
          <p className="text-[9px] text-muted-foreground tracking-[0.2em] uppercase mb-1">STREAK</p>
          <p className="text-2xl font-black text-duel-gold tabular-nums">
            {playerStreak > 0 ? `🔥${playerStreak}` : "0"}
          </p>
          <p className="text-[8px] text-muted-foreground/80 mt-0.5">This device</p>
        </div>
      </div>

      <div
        className={cn(
          "rounded-xl overflow-hidden mb-6 border border-white/5 bg-white/[0.02]",
        )}
      >
        <div className="flex justify-between px-4 py-2.5 border-b border-black/80">
          <span className="text-[9px] text-muted-foreground/70 tracking-[0.2em] uppercase">RANK</span>
          <span className="text-[9px] text-muted-foreground/70 tracking-[0.2em] uppercase">PLAYER</span>
          <span className="text-[9px] text-muted-foreground/70 tracking-[0.2em] uppercase">WINS</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[11px] text-muted-foreground tracking-[0.3em]">
            LOADING…
          </div>
        ) : entries.length === 0 ? (
          <div className="py-10 text-center text-[11px] text-muted-foreground/80 tracking-[0.2em]">
            NO ON-CHAIN CLAIMS YET
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.address + entry.rank}
              className={cn(
                "flex items-center justify-between px-4 py-3.5 border-b border-black/70 last:border-b-0",
                entry.rank === 1 ? "bg-duel-gold/[0.03]" : "",
              )}
            >
              <div className="w-10 shrink-0 text-center">
                {RANK_EMOJI[entry.rank] ? (
                  <span className="text-lg leading-none">{RANK_EMOJI[entry.rank]}</span>
                ) : (
                  <span className="text-xs font-bold text-muted-foreground tabular-nums">
                    {String(entry.rank).padStart(2, "0")}
                  </span>
                )}
              </div>
              <div className="flex-1 px-3 min-w-0">
                <p
                  className={cn(
                    "text-xs tracking-wide font-mono truncate",
                    entry.rank <= 3 ? "text-duel-gold font-semibold" : "text-muted-foreground",
                  )}
                  title={entry.address}
                >
                  {entry.address.slice(0, 6)}…{entry.address.slice(-4)}
                </p>
              </div>
              <div className="text-right shrink-0 tabular-nums">
                <p
                  className={cn(
                    "text-base font-black",
                    entry.rank <= 3 ? "text-duel-gold" : "text-muted-foreground",
                  )}
                >
                  {entry.wins}
                </p>
                <p className="text-[9px] text-muted-foreground/70 tracking-[0.1em]">WINS</p>
              </div>
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={() => router.push("/game")}
        className="w-full py-3.5 rounded-lg bg-duel-gold text-duel-bg border-0 text-xs font-black tracking-[0.3em] uppercase cursor-pointer font-sans hover:opacity-95 transition-opacity"
      >
        PLAY NOW
      </button>

      <p className="text-center mt-4 text-[9px] text-muted-foreground/50 tracking-[0.2em] uppercase leading-relaxed px-2">
        On-chain rankings use contract wins from successful rewards (PvP resolves count too).
      </p>
    </main>
  );
}
