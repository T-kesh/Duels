"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useReadContract, useAccount } from "wagmi";
import { cn } from "@/lib/utils";
import { DUEL_REWARDS_ADDRESS, DUEL_REWARDS_ABI } from "@/constants/contracts";
import { usePlayerNames, NAME_PATTERN } from "@/hooks/usePlayerNames";

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

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

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

  // Resolve display names for everyone on the board plus the connected
  // player (whose sticky status card renders even off-board).
  const nameAddresses = useMemo(() => {
    const addrs = entries.map((e) => e.address);
    if (address) addrs.push(address);
    return addrs;
  }, [entries, address]);
  const { names, myName, setDisplayName, status: nameStatus, error: nameError } = usePlayerNames(nameAddresses);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const displayFor = (addr: string) => names[addr.toLowerCase()] ?? shortAddress(addr);

  const savingName = nameStatus === "signing" || nameStatus === "saving";

  const submitName = async () => {
    const ok = await setDisplayName(nameInput);
    if (ok) {
      setEditingName(false);
      setNameInput("");
    }
  };

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

      {/* Display Name Card */}
      {address && (
        <div className="rounded-xl p-3.5 mb-6 bg-white/[0.02] border border-white/5">
          {!editingName ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[8px] text-muted-foreground tracking-widest uppercase mb-0.5">
                  Display Name
                </p>
                {myName ? (
                  <p className="text-sm font-semibold text-white truncate">{myName}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground/80 italic">
                    Not set — you appear as {shortAddress(address)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setNameInput(myName ?? "");
                  setEditingName(true);
                }}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-duel-gold/30 text-[9px] font-bold text-duel-gold uppercase tracking-[0.2em] hover:bg-duel-gold/10 transition-colors"
              >
                {myName ? "Change" : "Set Name"}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[8px] text-muted-foreground tracking-widest uppercase">
                Choose a display name
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && NAME_PATTERN.test(nameInput.trim()) && !savingName) {
                      submitName();
                    }
                  }}
                  maxLength={16}
                  placeholder="e.g. CardShark_7"
                  autoFocus
                  disabled={savingName}
                  className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-sans placeholder:text-muted-foreground/40 focus:outline-none focus:border-duel-gold/40"
                />
                <button
                  type="button"
                  onClick={submitName}
                  disabled={savingName || !NAME_PATTERN.test(nameInput.trim())}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-duel-gold text-duel-bg text-[9px] font-black uppercase tracking-[0.15em] disabled:opacity-40 hover:opacity-95 transition-opacity"
                >
                  {nameStatus === "signing" ? "Sign…" : nameStatus === "saving" ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  disabled={savingName}
                  className="shrink-0 px-2 py-1.5 rounded-lg border border-white/10 text-[9px] font-bold text-muted-foreground uppercase tracking-[0.15em] hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              <p className="text-[9px] text-muted-foreground/70">
                3–16 characters: letters, numbers, underscores. Saved with a free wallet signature.
              </p>
              {nameStatus === "error" && nameError && (
                <p className="text-[10px] text-destructive">{nameError}</p>
              )}
            </div>
          )}
        </div>
      )}

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
                          "text-xs tracking-wide truncate flex items-center gap-1.5",
                          names[entry.address.toLowerCase()] ? "font-sans" : "font-mono",
                          entry.rank <= 3 || isMe ? "text-duel-gold font-semibold" : "text-muted-foreground",
                        )}
                        title={entry.address}
                      >
                        <span className="truncate">{displayFor(entry.address)}</span>
                        {isMe && (
                          <span className="text-[8px] bg-duel-gold/20 text-duel-gold px-1.5 py-0.5 rounded font-sans font-bold uppercase tracking-wider scale-90 shrink-0">
                            You
                          </span>
                        )}
                      </p>
                      {names[entry.address.toLowerCase()] && (
                        <p className="text-[8px] font-mono text-muted-foreground/50 tracking-wide">
                          {shortAddress(entry.address)}
                        </p>
                      )}
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
              <p className={cn("text-xs text-white truncate max-w-[150px]", myName ? "font-sans font-semibold" : "font-mono")}>
                {myName ?? shortAddress(address)}
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
