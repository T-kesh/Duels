// "use client";

// import { type ReactNode, useState } from "react";
// import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// import { WagmiProvider } from "wagmi";
// import { config } from "@/lib/wagmi";

// export function Web3Provider({ children }: { children: ReactNode }) {
//   const [queryClient] = useState(() => new QueryClient());

//   return (
//     <WagmiProvider config={config}>
//       <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
//     </WagmiProvider>
//   );
// }
"use client";

import { type ReactNode, useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useConnect, useAccount } from "wagmi";
import { config } from "@/lib/wagmi";

function MiniPayAutoConnect() {
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (isConnected) return;

    // Auto-connect only inside MiniPay — never auto-trigger MetaMask
    const eth = window.ethereum as { isMiniPay?: boolean } | undefined;
    if (typeof window !== "undefined" && eth?.isMiniPay) {
      const miniPayConnector = connectors.find(
        (c) => c.id === "injected",
      );
      if (miniPayConnector) {
        connect({ connector: miniPayConnector });
      }
    }
  }, [connect, connectors, isConnected]);

  return null;
}

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <MiniPayAutoConnect />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}