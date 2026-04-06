// import { http, createConfig } from "wagmi";
// import { celo, celoAlfajores } from "wagmi/chains";
// import { injected, walletConnect } from "wagmi/connectors";

// const walletConnectProjectId = "d3f4a2c8e4f1b9a5c6d7e8f9a0b1c2d3";

// export const config = createConfig({
//   chains: [celoAlfajores, celo],
//   connectors: [
//     injected({
//       target: "coinbaseWallet",
//     }),
//     walletConnect({
//       projectId: walletConnectProjectId,
//       metadata: {
//         name: "DUEL - AI Card Battle",
//         description: "Beat CIPHER, the AI duelist. Earn cUSD.",
//         url: "https://duel-celo.vercel.app",
//         icons: ["https://duel-celo.vercel.app/favicon.ico"],
//       },
//     }),
//   ],
//   transports: {
//     [celo.id]: http(),
//     [celoAlfajores.id]: http(),
//   },
//   ssr: true,
// });

// declare module "wagmi" {
//   interface Register {
//     config: typeof config;
//   }
// }
import { http, createConfig } from "wagmi";
import { celo, celoAlfajores } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [celoAlfajores, celo],
  connectors: [
    injected(), // catches MiniPay's window.ethereum automatically
  ],
  transports: {
    [celo.id]: http(),
    [celoAlfajores.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}