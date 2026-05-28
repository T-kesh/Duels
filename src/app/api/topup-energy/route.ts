export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  http,
  erc20Abi,
  getAddress,
  decodeEventLog,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { celoAlfajores } from "viem/chains";

import { getRedis, setNxEx } from "@/lib/redis";
import { parsePlayerAddress } from "@/lib/addresses";
import { grantBonus } from "@/lib/playerStore";

const TOPUP_DEDUPE_TTL = 60 * 60 * 24 * 30; // 30 days

function memoryUsedHashes(): Set<string> {
  const g = globalThis as typeof globalThis & { __TOPUP_USED_TX__?: Set<string> };
  if (!g.__TOPUP_USED_TX__) g.__TOPUP_USED_TX__ = new Set<string>();
  return g.__TOPUP_USED_TX__;
}

async function markTxConsumed(hash: string): Promise<boolean> {
  const key = `topup:tx:${hash.toLowerCase()}`;
  const redis = getRedis();
  if (redis) {
    return setNxEx(key, "1", TOPUP_DEDUPE_TTL);
  }
  const set = memoryUsedHashes();
  if (set.has(key)) return false;
  set.add(key);
  return true;
}

function clientRpc() {
  const url =
    process.env.CELO_RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    celoAlfajores.rpcUrls.default.http[0];

  return createPublicClient({
    chain: celoAlfajores,
    transport: http(url),
  });
}

function extractTransfers(receipt: TransactionReceipt, token: Hex) {
  const matches = [];
  for (const log of receipt.logs) {
    const addr = log.address.toLowerCase();
    if (addr !== token.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: erc20Abi,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      matches.push(decoded);
    } catch {
      continue;
    }
  }
  return matches.filter((d) => d.eventName === "Transfer");
}

interface Body {
  txHash?: Hex | string;
  playerAddress?: `0x${string}` | string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const hash = typeof body.txHash === "string" ? (body.txHash as Hex) : undefined;
    if (!hash?.startsWith("0x")) {
      return NextResponse.json({ error: "missing_tx_hash" }, { status: 400 });
    }

    const playerRaw = typeof body.playerAddress === "string" ? body.playerAddress : undefined;
    if (!playerRaw) {
      return NextResponse.json({ error: "missing_player" }, { status: 400 });
    }

    const player = getAddress(playerRaw as Hex);
    const treasuryEnv =
      process.env.TOPUP_TREASURY ??
      process.env.NEXT_PUBLIC_TOPUP_TREASURY ??
      "0x0000000000000000000000000000000000000000";
    const treasury = getAddress(treasuryEnv as Hex);

    const tokenRaw = process.env.CUSD_TOKEN_ADDRESS ?? process.env.NEXT_PUBLIC_CUSD_ADDRESS;
    if (!tokenRaw) {
      return NextResponse.json({ error: "server_missing_cusd_env" }, { status: 500 });
    }
    const tokenAddress = getAddress(tokenRaw as Hex);

    const expectedWei = BigInt(
      process.env.TOPUP_AMOUNT_WEI ?? process.env.NEXT_PUBLIC_TOPUP_AMOUNT_WEI ?? "5000000000000000",
    );

    if (treasury === getAddress("0x0000000000000000000000000000000000000000")) {
      return NextResponse.json({ error: "misconfigured_topup_treasury" }, { status: 500 });
    }

    // Verify receipt BEFORE marking consumed so a transient RPC failure
    // does not permanently burn the tx hash in Redis.
    const rpc = clientRpc();

    const receipt = await rpc.getTransactionReceipt({ hash }).catch(() => undefined);
    if (!receipt || receipt.status !== "success") {
      return NextResponse.json({ error: "transaction_not_found_or_failed" }, { status: 400 });
    }

    const transfers = extractTransfers(receipt, tokenAddress);
    const match = transfers.find(
      (evt) =>
        evt.eventName === "Transfer" &&
        evt.args?.from?.toLowerCase() === player.toLowerCase() &&
        evt.args?.to?.toLowerCase() === treasury.toLowerCase() &&
        typeof evt.args.value === "bigint" &&
        evt.args.value >= expectedWei,
    );

    if (!match) {
      return NextResponse.json({ error: "transfer_mismatch_or_insufficient_amount" }, { status: 400 });
    }

    // Mark consumed only after we know the tx is valid (SET NX is atomic;
    // concurrent requests hitting this point will race safely).
    const consumed = await markTxConsumed(hash);
    if (!consumed) {
      return NextResponse.json({ error: "tx_already_consumed" }, { status: 409 });
    }

    const normalized = parsePlayerAddress(player);
    if (normalized) {
      await grantBonus(normalized, 1);
    }

    return NextResponse.json({ ok: true, bonusGrant: 1 });
  } catch (err) {
    console.error("topup-energy", err);
    return NextResponse.json({ error: "internal_topup_failure" }, { status: 500 });
  }
}
