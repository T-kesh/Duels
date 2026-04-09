"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface LeaderboardEntry {
  rank: number;
  address: string;
  wins: number;
  streak: number;
}

// Mock data for now — will be replaced with contract call
function getMockLeaderboard(): LeaderboardEntry[] {
  return [
    { rank: 1, address: "0x1a2b...3c4d", wins: 24, streak: 7 },
    { rank: 2, address: "0x5e6f...7g8h", wins: 18, streak: 3 },
    { rank: 3, address: "0x9i0j...1k2l", wins: 15, streak: 5 },
    { rank: 4, address: "0x3m4n...5o6p", wins: 12, streak: 2 },
    { rank: 5, address: "0x7q8r...9s0t", wins: 9, streak: 1 },
  ];
}

const RANK_COLORS: Record<number, string> = {
  1: "#fcc419",
  2: "#adb5bd",
  3: "#cd7f32",
};

const RANK_EMOJIS: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

export default function LeaderboardPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [playerWins, setPlayerWins] = useState(0);
  const [playerStreak, setPlayerStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load local player stats
    const wins = parseInt(localStorage.getItem('duel_total_wins') || '0');
    const streak = parseInt(localStorage.getItem('duel_streak') || '0');
    setPlayerWins(wins);
    setPlayerStreak(streak);

    // Load leaderboard (mock for now)
    setTimeout(() => {
      setEntries(getMockLeaderboard());
      setLoading(false);
    }, 800);
  }, []);

  return (
    <main style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      display: "flex",
      flexDirection: "column",
      padding: "20px 16px",
      fontFamily: "'Courier New', monospace",
      maxWidth: "420px",
      margin: "0 auto",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <button
          onClick={() => router.push("/")}
          style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "12px", letterSpacing: "2px", fontFamily: "'Courier New', monospace", padding: 0 }}
        >
          ← BACK
        </button>
        <span style={{ fontSize: "14px", fontWeight: "900", color: "#fcc419", letterSpacing: "4px" }}>
          LEADERBOARD
        </span>
        <span style={{ width: "60px" }} />
      </div>

      {/* Player Stats */}
      <div style={{
        background: "rgba(252,196,25,0.05)",
        border: "1px solid rgba(252,196,25,0.15)",
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "24px",
        display: "flex",
        justifyContent: "space-around",
      }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "9px", color: "#555", letterSpacing: "2px", marginBottom: "4px" }}>YOUR WINS</p>
          <p style={{ fontSize: "24px", fontWeight: "900", color: "#fcc419" }}>{playerWins}</p>
        </div>
        <div style={{ width: "1px", background: "#1a1a1a" }} />
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "9px", color: "#555", letterSpacing: "2px", marginBottom: "4px" }}>STREAK</p>
          <p style={{ fontSize: "24px", fontWeight: "900", color: "#fcc419" }}>
            {playerStreak > 0 ? `🔥${playerStreak}` : "0"}
          </p>
        </div>
      </div>

      {/* Leaderboard List */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
        borderRadius: "12px",
        overflow: "hidden",
        marginBottom: "24px",
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: "1px solid #111",
        }}>
          <span style={{ fontSize: "9px", color: "#333", letterSpacing: "2px" }}>RANK</span>
          <span style={{ fontSize: "9px", color: "#333", letterSpacing: "2px" }}>PLAYER</span>
          <span style={{ fontSize: "9px", color: "#333", letterSpacing: "2px" }}>WINS</span>
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <p style={{ color: "#333", fontSize: "11px", letterSpacing: "3px" }}>LOADING...</p>
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.rank}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderBottom: "1px solid #0f0f0f",
                background: entry.rank === 1 ? "rgba(252,196,25,0.03)" : "transparent",
              }}
            >
              {/* Rank */}
              <div style={{ width: "40px", textAlign: "center" }}>
                {RANK_EMOJIS[entry.rank] ? (
                  <span style={{ fontSize: "18px" }}>{RANK_EMOJIS[entry.rank]}</span>
                ) : (
                  <span style={{ fontSize: "12px", color: "#444", fontWeight: "700" }}>
                    {String(entry.rank).padStart(2, "0")}
                  </span>
                )}
              </div>

              {/* Address */}
              <div style={{ flex: 1, paddingLeft: "12px" }}>
                <p style={{
                  fontSize: "12px",
                  color: RANK_COLORS[entry.rank] || "#666",
                  fontWeight: entry.rank <= 3 ? "700" : "400",
                  letterSpacing: "1px",
                }}>
                  {entry.address}
                </p>
                {entry.streak > 0 && (
                  <p style={{ fontSize: "9px", color: "#444", marginTop: "2px" }}>
                    🔥 {entry.streak} streak
                  </p>
                )}
              </div>

              {/* Wins */}
              <div style={{ textAlign: "right" }}>
                <p style={{
                  fontSize: "16px",
                  fontWeight: "900",
                  color: RANK_COLORS[entry.rank] || "#555",
                }}>
                  {entry.wins}
                </p>
                <p style={{ fontSize: "9px", color: "#333", letterSpacing: "1px" }}>WINS</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Play button */}
      <button
        onClick={() => router.push("/game")}
        style={{
          width: "100%",
          padding: "14px",
          background: "#fcc419",
          color: "#0a0a0f",
          border: "none",
          borderRadius: "10px",
          fontSize: "12px",
          fontWeight: "900",
          letterSpacing: "4px",
          cursor: "pointer",
          fontFamily: "'Courier New', monospace",
        }}
      >
        PLAY NOW
      </button>

      <p style={{ textAlign: "center", marginTop: "16px", fontSize: "9px", color: "#222", letterSpacing: "2px" }}>
        ONCHAIN LEADERBOARD COMING SOON
      </p>
    </main>
  );
}