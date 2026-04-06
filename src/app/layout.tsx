import type { Metadata, Viewport } from "next";
import { Web3Provider } from "@/providers/web3-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "DUEL ⚔️ — AI Card Battle on Celo",
  description:
    "Beat CIPHER, the AI duelist. Earn cUSD rewards. Built for Celo MiniPay.",
  keywords: ["celo", "minipay", "card game", "ai", "duel", "web3"],
  openGraph: {
    title: "DUEL ⚔️",
    description: "AI Card Battle on Celo MiniPay",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
