"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useAccount } from "wagmi";

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
    <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "'Courier New', monospace", textAlign: "center" }}>
      <div style={{ position: "fixed", top: "30%", left: "50%", transform: "translateX(-50%)", width: "300px", height: "300px", borderRadius: "50%", background: won ? "radial-gradient(circle, rgba(53,212,106,0.1) 0%, transparent 70%)" : "radial-gradient(circle, rgba(255,77,79,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: "320px", width: "100%" }}>
        <div style={{ fontSize: "72px", marginBottom: "12px", filter: `drop-shadow(0 0 24px ${won ? "rgba(53,212,106,0.5)" : "rgba(255,77,79,0.4)"})` }}>
          {won ? "🏆" : "💀"}
        </div>

        <h1 style={{ fontSize: "36px", fontWeight: "900", letterSpacing: "6px", color: won ? "#35d46a" : "#ff4d4f", marginBottom: "8px" }}>
          {won ? "VICTORY" : "DEFEATED"}
        </h1>

        <p style={{ color: "#555", fontSize: "11px", letterSpacing: "3px", marginBottom: "32px" }}>
          {won ? "CIPHER HAS FALLEN" : "CIPHER WINS THIS ROUND"}
        </p>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "20px", marginBottom: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-around" }}>
            <div>
              <p style={{ fontSize: "9px", color: "#555", letterSpacing: "2px", marginBottom: "6px" }}>YOUR HP</p>
              <p style={{ fontSize: "28px", fontWeight: "900", color: playerHp > 0 ? "#35d46a" : "#ff4d4f" }}>{playerHp}</p>
            </div>
            <div style={{ width: "1px", background: "#1a1a1a" }} />
            <div>
              <p style={{ fontSize: "9px", color: "#555", letterSpacing: "2px", marginBottom: "6px" }}>CIPHER HP</p>
              <p style={{ fontSize: "28px", fontWeight: "900", color: aiHp > 0 ? "#ff4d4f" : "#35d46a" }}>{aiHp}</p>
            </div>
          </div>
        </div>

        {won && claimState === "pending" && (
          <div style={{ background: "rgba(53,212,106,0.05)", border: "1px solid rgba(53,212,106,0.2)", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
            <p style={{ fontSize: "10px", color: "#35d46a", letterSpacing: "3px", marginBottom: "4px" }}>REWARD PROCESSING</p>
            <p style={{ fontSize: "22px", fontWeight: "900", color: "#fff", marginBottom: "12px" }}>0.05 cUSD</p>
            <p style={{ fontSize: "11px", color: "#9ad9b0", lineHeight: "1.5" }}>
              Your win already triggered an automatic reward claim. Wallet confirmation and chain timing can take a moment.
            </p>
          </div>
        )}

        {won && claimState === "none" && (
          <div style={{ background: "rgba(53,212,106,0.05)", border: "1px solid rgba(53,212,106,0.2)", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
            <p style={{ fontSize: "13px", color: "#35d46a", letterSpacing: "2px" }}>0.05 cUSD reward is tied to this win.</p>
          </div>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => router.push("/game")} style={{ flex: 1, padding: "14px", background: "#fcc419", color: "#0a0a0f", border: "none", borderRadius: "10px", fontSize: "12px", fontWeight: "900", letterSpacing: "3px", cursor: "pointer", fontFamily: "'Courier New', monospace" }}>
            REMATCH
          </button>
          <button onClick={() => router.push("/")} style={{ flex: 1, padding: "14px", background: "transparent", color: "#555", border: "1px solid #222", borderRadius: "10px", fontSize: "12px", fontWeight: "700", letterSpacing: "2px", cursor: "pointer", fontFamily: "'Courier New', monospace" }}>
            HOME
          </button>
        </div>
      </div>
    </main>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#fcc419", fontFamily: "monospace", letterSpacing: "3px" }}>LOADING...</p>
      </main>
    }>
      <ResultContent />
    </Suspense>
  );
}
