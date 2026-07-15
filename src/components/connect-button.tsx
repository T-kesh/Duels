"use client";

import { useEffect, useState } from "react";
import { useConnect, useAccount, useDisconnect } from "wagmi";
import { Wallet } from "lucide-react";
import { GlowButton } from "./ui/GlowButton";

function connectorLabel(id: string, name: string): string {
  if (id === "metaMask" || name.toLowerCase().includes("metamask")) return "MetaMask";
  if (name.toLowerCase().includes("minipay")) return "MiniPay";
  if (id === "injected") return "Browser Wallet";
  return name || "Connect Wallet";
}

export function ConnectButton() {
  const { connect, connectors, isPending } = useConnect();
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const [isMiniPay, setIsMiniPay] = useState(false);
  const [hasMetaMask, setHasMetaMask] = useState(false);

  useEffect(() => {
    const eth = window.ethereum as { isMiniPay?: boolean; isMetaMask?: boolean } | undefined;
    if (typeof window === "undefined" || !eth) return;
    if (eth.isMiniPay) setIsMiniPay(true);
    if (eth.isMetaMask) setHasMetaMask(true);
  }, []);

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

  if (isMiniPay) {
    return (
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="w-6 h-6 border-2 border-duel-gold/20 border-t-duel-gold rounded-full animate-spin mb-1" />
        <span className="text-[10px] text-muted-foreground tracking-widest uppercase animate-pulse">Connecting...</span>
      </div>
    );
  }

  const metaMaskConnector = connectors.find((c) => c.id === "metaMask");
  const genericConnector = connectors.find((c) => c.id === "injected");
  const otherConnectors = connectors.filter(
    (c) => c.uid !== metaMaskConnector?.uid && c.uid !== genericConnector?.uid,
  );

  // Only collapse to a single MetaMask button when MetaMask is genuinely the
  // active injected provider. Otherwise show the generic connector too, so
  // any other injected wallet (Rabby, Brave, Coinbase extension, etc.) still
  // has a working connect path — a MetaMask id existing in `connectors` just
  // means it's configured, not that the user actually has it installed.
  const primaryConnectors = hasMetaMask
    ? [metaMaskConnector].filter(Boolean)
    : [genericConnector, metaMaskConnector].filter(Boolean);

  return (
    <div className="flex flex-col gap-3 w-full max-w-[280px]">
      {primaryConnectors.map((connector) => (
        <GlowButton
          key={connector!.uid}
          onClick={() => connect({ connector: connector! })}
          disabled={isPending}
          className="w-full gap-2"
        >
          <Wallet className="w-4 h-4" />
          {isPending ? "Connecting..." : `Connect with ${connectorLabel(connector!.id, connector!.name)}`}
        </GlowButton>
      ))}
      {otherConnectors.map((connector) => (
        <GlowButton
          key={connector.uid}
          variant="outline"
          onClick={() => connect({ connector })}
          disabled={isPending}
          className="w-full gap-2"
        >
          <Wallet className="w-4 h-4" />
          {isPending ? "Connecting..." : connectorLabel(connector.id, connector.name)}
        </GlowButton>
      ))}
    </div>
  );
}