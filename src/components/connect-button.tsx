"use client";

import { useConnect, useAccount, useDisconnect } from "wagmi";

export function ConnectButton() {
  const { connect, connectors, isPending } = useConnect();
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            color: "#35d46a",
            letterSpacing: "1px",
          }}
        >
          ● CONNECTED
        </span>
        <span
          style={{
            fontSize: "10px",
            color: "#666",
            fontFamily: "'Courier New', monospace",
          }}
        >
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          style={{
            padding: "6px 16px",
            background: "transparent",
            color: "#444",
            border: "1px solid #222",
            borderRadius: "6px",
            fontSize: "10px",
            letterSpacing: "2px",
            cursor: "pointer",
            fontFamily: "'Courier New', monospace",
            transition: "all 0.2s ease",
          }}
        >
          DISCONNECT
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        width: "100%",
      }}
    >
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          disabled={isPending}
          style={{
            width: "100%",
            padding: "14px",
            background: isPending
              ? "rgba(252,196,25,0.1)"
              : "rgba(252,196,25,0.08)",
            color: "#fcc419",
            border: "1px solid rgba(252,196,25,0.2)",
            borderRadius: "10px",
            fontSize: "12px",
            fontWeight: "700",
            letterSpacing: "2px",
            cursor: isPending ? "not-allowed" : "pointer",
            fontFamily: "'Courier New', monospace",
            transition: "all 0.2s ease",
          }}
        >
          {isPending ? "CONNECTING..." : "CONNECT WALLET"}
        </button>
      ))}
    </div>
  );
}
