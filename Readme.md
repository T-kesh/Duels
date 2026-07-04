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
# Required: ANTHROPIC_API_KEY, PRIVATE_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
# Production (Vercel): Redis is required — in-memory session state does not survive cold starts
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

See [`.env.local.example`](.env.local.example).

| Variable | Required | Purpose |
|----------|----------|---------|
| `UPSTASH_REDIS_REST_URL` | Production | Duel sessions, energy, rate limits |
| `UPSTASH_REDIS_REST_TOKEN` | Production | Upstash auth |
| `ANTHROPIC_API_KEY` | Yes | CIPHER AI moves |
| `PRIVATE_KEY` | Yes | Reward / PvP settlement signatures |
| `CELO_RPC_URL` | Top-up / PvP | On-chain verification |
| `NEXT_PUBLIC_DUEL_REWARDS_ADDRESS` | Yes | Contract address |
| `NEXT_PUBLIC_CUSD_ADDRESS` | Top-up | cUSD token |
| `TOPUP_TREASURY` / `NEXT_PUBLIC_TOPUP_TREASURY` | Top-up | Receives refill payments |

Implementation roadmap: [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Celo Documentation](https://docs.celo.org/)
