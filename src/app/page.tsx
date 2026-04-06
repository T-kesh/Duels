"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@/components/connect-button";

export default function Home() {
  const { isConnected } = useAccount();
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "'Courier New', monospace",
      }}
    >
      <div
        style={{
          position: "fixed",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(252,196,25,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ textAlign: "center", maxWidth: "340px", width: "100%" }}>
        <div style={{ fontSize: "64px", marginBottom: "8px", filter: "drop-shadow(0 0 20px rgba(252,196,25,0.4))" }}>
          ⚔️
        </div>

        <h1 style={{ fontSize: "48px", fontWeight: "900", color: "#fcc419", letterSpacing: "8px", margin: "0 0 4px", textShadow: "0 0 30px rgba(252,196,25,0.5)" }}>
          DUEL
        </h1>

        <p style={{ fontSize: "11px", color: "#666", letterSpacing: "4px", textTransform: "uppercase", marginBottom: "40px" }}>
          AI Card Battle · Earn cUSD
        </p>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(252,196,25,0.15)", borderRadius: "12px", padding: "20px", marginBottom: "32px", textAlign: "left" }}>
          <p style={{ fontSize: "10px", color: "#fcc419", letterSpacing: "3px", marginBottom: "12px" }}>HOW TO PLAY</p>
          {["Pick 1 card each turn", "Beat CIPHER across 3 turns", "Higher HP at end wins", "Winners earn cUSD rewards"].map((step, i) => (
            <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "8px", alignItems: "center" }}>
              <span style={{ color: "#fcc419", fontSize: "12px" }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ color: "#aaa", fontSize: "13px" }}>{step}</span>
            </div>
          ))}
        </div>

        {isConnected ? (
          <button
            onClick={() => router.push("/game")}
            style={{ width: "100%", padding: "16px", background: "#fcc419", color: "#0a0a0f", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "900", letterSpacing: "4px", cursor: "pointer", fontFamily: "'Courier New', monospace" }}
          >
            ENTER DUEL
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
            <p style={{ color: "#555", fontSize: "12px" }}>Connect your MiniPay wallet to play</p>
            <ConnectButton />
          </div>
        )}

        <p style={{ marginTop: "24px", fontSize: "10px", color: "#333", letterSpacing: "2px" }}>
          BUILT ON CELO · PROOF OF SHIP
        </p>
      </div>
    </main>
  );
}