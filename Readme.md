# DUEL ⚔️ — AI Card Battle on Celo MiniPay

Beat CIPHER, the AI duelist. Earn cUSD. Built for Celo's Proof of Ship.

## Stack
- **Next.js 14** — mini app frontend
- **Wagmi + Viem** — MiniPay wallet connection
- **Claude API** — CIPHER AI opponent
- **Solidity** — DuelRewards.sol reward contract
- **Celo / Alfajores** — blockchain + cUSD payments

## Game Loop
1. Connect MiniPay wallet → Draw 3 cards → Battle CIPHER (3 turns) → Higher HP wins → Claim 0.05 cUSD

## Setup
```bash
cd apps/web && npm install
cp .env.local.example .env.local  # add ANTHROPIC_API_KEY
npm run dev
npx ngrok http 3000  # for MiniPay testing
```

## Proof of Ship
Register: https://talent.app/~/earn/celo-proof-of-ship (deadline: 26th April)

A new Celo blockchain project

A modern Celo blockchain application built with Next.js, TypeScript, and Turborepo.

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start the development server:
   ```bash
   pnpm dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

This is a monorepo managed by Turborepo with the following structure:

- `apps/web` - Next.js application with embedded UI components and utilities
- `apps/hardhat` - Smart contract development environment

## Available Scripts

- `pnpm dev` - Start development servers
- `pnpm build` - Build all packages and apps
- `pnpm lint` - Lint all packages and apps
- `pnpm type-check` - Run TypeScript type checking

### Smart Contract Scripts

- `pnpm contracts:compile` - Compile smart contracts
- `pnpm contracts:test` - Run smart contract tests
- `pnpm contracts:deploy` - Deploy contracts to local network
- `pnpm contracts:deploy:celo-sepolia` - Deploy to Celo Sepolia Testnet
- `pnpm contracts:deploy:celo` - Deploy to Celo Mainnet

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Smart Contracts**: Hardhat with Viem
- **Monorepo**: Turborepo
- **Package Manager**: PNPM

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Celo Documentation](https://docs.celo.org/)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com/)