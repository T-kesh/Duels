# DUEL ⚔️ — AI Card Battle on Celo MiniPay

Beat CIPHER, the AI duelist. Earn cUSD. Built for Celo Proof of Ship.

## Stack

- **Next.js 14** (App Router) — mini app in `src/app`
- **Wagmi + Viem** — MiniPay / injected wallet
- **Claude API** — CIPHER AI opponent
- **Solidity** — `DuelRewards.sol` (AI rewards + optional PvP escrow)
- **Celo / Alfajores** — network + cUSD

## Game loop

1. Connect wallet → server deals 3 cards → battle CIPHER (3 turns) → higher HP wins → claim 0.05 cUSD (signed by operator key)

## Setup

```bash
npm install
cp .env.local.example .env.local
# Set ANTHROPIC_API_KEY, PRIVATE_KEY (operator for claim signatures), optional CELO_RPC_URL for top-up verification
npm run dev
```

Use `npx ngrok http 3000` if you need a public URL for MiniPay testing.

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript check |

## Project layout

- `src/app` — routes (`/`, `/game`, `/result`, `/leaderboard`, `/pvp`)
- `src/components` — UI (game pieces, buttons, arena)
- `src/hooks` — game, claim, energy
- `src/contracts` — Solidity sources
- `src/constants` — cards, ABIs, addresses

## Environment

See [`.env.local.example`](.env.local.example): `ANTHROPIC_API_KEY`, `PRIVATE_KEY`, optional `CELO_RPC_URL`, `NEXT_PUBLIC_TOPUP_TREASURY`, `NEXT_PUBLIC_TOPUP_AMOUNT_WEI`, `NEXT_PUBLIC_CUSD_ADDRESS`.

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Celo Documentation](https://docs.celo.org/)
