"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useReadContract, useAccount } from "wagmi";
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
  const { address } = useAccount();
  const [playerStreak, setPlayerStreak] = useState(0);
  const [playerBestStreak, setPlayerBestStreak] = useState(0);
  const [showAll, setShowAll] = useState(false);

  // Read leaderboard data from contract
  const { data: leaderboardData, isLoading: loading } = useReadContract({
    address: DUEL_REWARDS_ADDRESS as `0x${string}`,
    abi: DUEL_REWARDS_ABI,
    functionName: "getLeaderboard",
    query: {
      refetchOnMount: "always",
    },
  });

  // Read player's own total wins from contract
  const { data: rawOnChainWins, isLoading: loadingOnChainWins } = useReadContract({
    address: DUEL_REWARDS_ADDRESS as `0x${string}`,
    abi: DUEL_REWARDS_ABI,
    functionName: "totalWins",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchOnMount: "always",
    },
  });

  const onChainWins = rawOnChainWins ? Number(rawOnChainWins) : 0;

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  // 1. Local storage stats read on mount
  useEffect(() => {
    const streak = parseInt(localStorage.getItem("duel_streak") || "0", 10);
    const bestStreak = parseInt(localStorage.getItem("duel_best_streak") || "0", 10);
    setPlayerStreak(streak);
    setPlayerBestStreak(bestStreak);
  }, []);

  // 2. On-chain leaderboard parsing (sorted & ranked correctly)
  useEffect(() => {
    if (leaderboardData) {
      const [addrs, winsArr] = leaderboardData as [string[], bigint[]];
      
      const formattedEntries = addrs
        .map((addr, i) => ({
          address: addr,
          wins: Number(winsArr[i]),
        }))
        // Filter out zero-win entries first
        .filter((e) => e.wins > 0)
        // Sort descending by wins
        .sort((a, b) => b.wins - a.wins)
        // Assign ranks after sorting & filtering
        .map((entry, idx) => ({
          rank: idx + 1,
          address: entry.address,
          wins: entry.wins,
        }));

      setEntries(formattedEntries);
    }
  }, [leaderboardData]);

  // Determine top 10 vs show all
  const visibleEntries = useMemo(() => {
    if (showAll) return entries;
    return entries.slice(0, 10);
  }, [entries, showAll]);

  // Calculate connected user's rank from all entries
  const myEntry = useMemo(() => {
    if (!address) return null;
    return entries.find((e) => e.address.toLowerCase() === address.toLowerCase()) || null;
  }, [entries, address]);

  // If user is not in top 10 / not found but has wins, we calculate their rank
  const myComputedRank = useMemo(() => {
    if (!address || onChainWins === 0) return null;
    if (myEntry) return myEntry.rank;

    // Not in returned leaderboard entries array but has wins? 
    // Calculate how many entries have more wins than the player.
    const ranksAhead = entries.filter((e) => e.wins > onChainWins).length;
    return ranksAhead + 1;
  }, [address, onChainWins, myEntry, entries]);

  // Check if player is already rendered in the current visible list
  const isMeVisible = useMemo(() => {
    if (!address) return false;
    return visibleEntries.some((e) => e.address.toLowerCase() === address.toLowerCase());
  }, [visibleEntries, address]);

  return (
    <main className="min-h-screen bg-duel-bg flex flex-col px-4 py-5 max-w-[420px] mx-auto font-sans pb-24 relative">
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

      {/* Streak Dashboard Card */}
      <div
        className={cn(
          "rounded-xl p-4 mb-6 flex justify-around gap-4",
          "bg-duel-gold/[0.05] border border-duel-gold/15",
        )}
      >
        <div className="text-center flex-1">
          <p className="text-[9px] text-muted-foreground tracking-[0.2em] uppercase mb-1">
            CURRENT STREAK
          </p>
          <p className="text-2xl font-black text-duel-gold tabular-nums">
            {playerStreak > 0 ? `🔥${playerStreak}` : "0"}
          </p>
          <p className="text-[8px] text-muted-foreground/80 mt-0.5">Active Run</p>
        </div>
        <div className="w-px bg-white/10 self-stretch min-h-[48px]" />
        <div className="text-center flex-1">
          <p className="text-[9px] text-muted-foreground tracking-[0.2em] uppercase mb-1">
            BEST STREAK
          </p>
          <p className="text-2xl font-black text-duel-gold tabular-nums">
            {playerBestStreak > 0 ? `👑${playerBestStreak}` : "0"}
          </p>
          <p className="text-[8px] text-muted-foreground/80 mt-0.5">All-time High</p>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div
        className={cn(
          "rounded-xl overflow-hidden mb-3 border border-white/5 bg-white/[0.02]",
        )}
      >
        <div className="flex justify-between px-4 py-2.5 border-b border-black/80">
          <span className="text-[9px] text-muted-foreground/70 tracking-[0.2em] uppercase">RANK</span>
          <span className="text-[9px] text-muted-foreground/70 tracking-[0.2em] uppercase">PLAYER</span>
          <span className="text-[9px] text-muted-foreground/70 tracking-[0.2em] uppercase">WINS</span>
        </div>

        {loading ? (
          // Shimmer loading skeletons
          <div className="divide-y divide-black/40">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-4">
                <div className="w-10 h-4 rounded animate-skeleton bg-white/5" />
                <div className="flex-1 px-6">
                  <div className="w-24 h-4 rounded animate-skeleton bg-white/5" />
                </div>
                <div className="w-12 h-4 rounded animate-skeleton bg-white/5" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-10 text-center text-[11px] text-muted-foreground/80 tracking-[0.2em]">
            NO ON-CHAIN CLAIMS YET
          </div>
        ) : (
          <>
            <div className="divide-y divide-black/40">
              {visibleEntries.map((entry) => {
                const isMe = address && entry.address.toLowerCase() === address.toLowerCase();
                return (
                  <div
                    key={entry.address + entry.rank}
                    className={cn(
                      "flex items-center justify-between px-4 py-3.5 transition-colors",
                      entry.rank === 1 ? "bg-duel-gold/[0.03]" : "",
                      isMe ? "bg-duel-gold/[0.07] border-l-2 border-l-duel-gold/60" : "",
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
                          "text-xs tracking-wide font-mono truncate flex items-center gap-1.5",
                          entry.rank <= 3 || isMe ? "text-duel-gold font-semibold" : "text-muted-foreground",
                        )}
                        title={entry.address}
                      >
                        <span>{entry.address.slice(0, 6)}…{entry.address.slice(-4)}</span>
                        {isMe && (
                          <span className="text-[8px] bg-duel-gold/20 text-duel-gold px-1.5 py-0.5 rounded font-sans font-bold uppercase tracking-wider scale-90">
                            You
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <p
                        className={cn(
                          "text-base font-black",
                          entry.rank <= 3 || isMe ? "text-duel-gold" : "text-muted-foreground",
                        )}
                      >
                        {entry.wins}
                      </p>
                      <p className="text-[9px] text-muted-foreground/70 tracking-[0.1em]">WINS</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* View All / Collapse Toggle */}
      {!loading && entries.length > 10 && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="text-center w-full py-2 mb-4 text-[10px] font-bold text-duel-gold/80 hover:text-duel-gold transition-colors uppercase tracking-[0.2em]"
        >
          {showAll ? "Collapse List ▲" : `+ ${entries.length - 10} More players · View All ▼`}
        </button>
      )}

      {/* Sticky Own Rank Info (shown if not in current visible leaderboard slice) */}
      {address && !loading && !loadingOnChainWins && !isMeVisible && (
        <div className="rounded-xl p-3 bg-white/[0.03] border border-white/5 mb-6 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="text-base">🛡️</span>
            <div>
              <p className="text-[8px] text-muted-foreground tracking-widest uppercase">Your Status</p>
              <p className="text-xs font-mono text-white truncate max-w-[150px]">
                {address.slice(0, 6)}…{address.slice(-4)}
              </p>
            </div>
          </div>
          <div className="text-right">
            {onChainWins > 0 ? (
              <>
                <p className="text-[8px] text-duel-gold tracking-widest uppercase font-bold">
                  Rank #{myComputedRank}
                </p>
                <p className="text-sm font-black text-white tabular-nums">
                  {onChainWins} <span className="text-[9px] font-normal text-muted-foreground">WINS</span>
                </p>
              </>
            ) : (
              <p className="text-[9px] text-muted-foreground/80 tracking-wide">
                No on-chain claims yet
              </p>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => router.push("/game")}
        className="w-full py-3.5 rounded-lg bg-duel-gold text-duel-bg border-0 text-xs font-black tracking-[0.3em] uppercase cursor-pointer font-sans hover:opacity-95 transition-opacity"
      >
        PLAY NOW
      </button>
    </main>
  );
}
