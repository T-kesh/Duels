"use client";

import { useConnect, useAccount, useDisconnect } from "wagmi";
import { GlowButton } from "./ui/GlowButton";
import { cn } from "@/lib/utils";

export function ConnectButton() {
  const { connect, connectors, isPending } = useConnect();
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1 bg-celo-green/10 border border-celo-green/20 rounded-full">
          <span className="w-1.5 h-1.5 bg-celo-green rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-celo-green tracking-widest uppercase">Connected</span>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="text-[10px] font-bold text-muted-foreground hover:text-white transition-colors uppercase tracking-[0.2em]"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-[280px]">
      {connectors.map((connector) => (
        <GlowButton
          key={connector.uid}
          onClick={() => connect({ connector })}
          disabled={isPending}
          className="w-full"
        >
          {isPending ? "Connecting..." : "Connect Wallet"}
        </GlowButton>
      ))}
    </div>
  );
}
