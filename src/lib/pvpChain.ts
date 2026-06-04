import crypto from "crypto";
import { createPublicClient, http, getAddress, zeroAddress, type Hex } from "viem";
import { celoAlfajores } from "viem/chains";

import { DUEL_REWARDS_ABI, DUEL_REWARDS_ADDRESS } from "@/constants/contracts";
import { drawHandWithRng } from "@/constants/cards";
import { STARTING_HP, type Card } from "@/constants/cards";
import { getTotalWins } from "@/lib/playerStore";
import { getRedis, setNxEx } from "@/lib/redis";
import {
  getPvpSession,
  savePvpSession,
  getPvpPick,
  setPvpPickNx,
  getPvpToken,
  acquireRoundResolveLock,
  ROUND_DEADLINE_MS,
  type PvpDuelSession,
} from "@/lib/pvpSessionStore";
import {
  applyPvpRound,
  determinePvpOutcome,
  needsSuddenDeath,
  type PvpSlot,
} from "@/lib/pvpGameEngine";

export interface OnChainDuel {
  player1: string; // lowercased
  player2: string; // lowercased
  wager: bigint;
  isActive: boolean;
}

export function pvpRpcClient() {
  const url =
    process.env.CELO_RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    celoAlfajores.rpcUrls.default.http[0];
  return createPublicClient({ chain: celoAlfajores, transport: http(url) });
}

function contractAddress(): Hex {
  return (process.env.NEXT_PUBLIC_DUEL_REWARDS_ADDRESS || DUEL_REWARDS_ADDRESS) as Hex;
}

/** Read the on-chain duel row. Returns null if the duel does not exist / read fails. */
export async function readOnChainDuel(duelId: bigint): Promise<OnChainDuel | null> {
  try {
    const duel = await pvpRpcClient().readContract({
      address: contractAddress(),
      abi: DUEL_REWARDS_ABI,
      functionName: "duels",
      args: [duelId],
    });
    const tuple = duel as unknown as readonly [Hex, Hex, bigint, boolean];
    return {
      player1: getAddress(tuple[0]).toLowerCase(),
      player2: tuple[1] === zeroAddress ? zeroAddress : getAddress(tuple[1]).toLowerCase(),
      wager: tuple[2],
      isActive: tuple[3],
    };
  } catch (err) {
    console.warn("[pvpChain] readOnChainDuel failed:", err);
    return null;
  }
}

/** Which slot (if any) an address occupies in a session. */
export function slotForAddress(
  session: PvpDuelSession,
  address: string,
): PvpSlot | null {
  const a = address.toLowerCase();
  if (a === session.player1) return "p1";
  if (a === session.player2) return "p2";
  return null;
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Human-readable message the wallet signs to prove control of its address. */
export function challengeMessage(duelId: string, address: string, nonce: string): string {
  return `Duel Arena PvP authentication\nDuel: ${duelId}\nPlayer: ${address}\nNonce: ${nonce}`;
}

export function issueToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, hash: hashToken(token) };
}

/** Crypto-strong uniform [0,1) RNG, matching /api/start-duel. */
function cryptoRng(): number {
  return crypto.randomInt(281474976710655) / 281474976710655;
}

export type PvpAuthResult =
  | { ok: true; session: PvpDuelSession; slot: PvpSlot }
  | { ok: false; error: string; status: number };

/**
 * Validate a move/state request: the session must exist, the address must hold
 * a seat, and the bearer token must match the one issued to that seat at auth.
 */
export async function authenticatePvp(
  duelId: string,
  address: string,
  token: string | undefined,
): Promise<PvpAuthResult> {
  const session = await getPvpSession(duelId);
  if (!session) return { ok: false, error: "unknown_or_expired_duel", status: 404 };

  const slot = slotForAddress(session, address);
  if (!slot) return { ok: false, error: "not_a_participant", status: 403 };

  if (!token) return { ok: false, error: "missing_token", status: 401 };
  const expected = await getPvpToken(duelId, slot);
  if (!expected || expected !== hashToken(token)) {
    return { ok: false, error: "bad_token", status: 401 };
  }

  return { ok: true, session, slot };
}

/**
 * Fetch the PvP gameplay session for an on-chain duel, creating it (and dealing
 * both equal-pool hands) exactly once if it does not yet exist. Both players are
 * read authoritatively from chain; the duel must be active with both seats filled.
 *
 * Returns null when the duel is not joinable/playable (not found, not active, or
 * still waiting for player2).
 */
export async function getOrCreatePvpSession(
  duelId: string,
): Promise<PvpDuelSession | null> {
  const existing = await getPvpSession(duelId);
  if (existing) return existing;

  const onChain = await readOnChainDuel(BigInt(duelId));
  if (!onChain || !onChain.isActive) return null;
  if (onChain.player2 === zeroAddress) return null; // not joined yet

  // Init lock so two concurrent auth requests don't each deal a fresh hand.
  const redis = getRedis();
  if (redis) {
    const locked = await setNxEx(`pvp:init:${duelId}`, "1", 60);
    if (!locked) {
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 150));
        const s = await getPvpSession(duelId);
        if (s) return s;
      }
      // Lock holder never wrote (crash?) — fall through and create.
    } else {
      // Double-check inside the lock.
      const s = await getPvpSession(duelId);
      if (s) return s;
    }
  }

  const [w1, w2] = await Promise.all([
    getTotalWins(onChain.player1),
    getTotalWins(onChain.player2),
  ]);
  const poolWins = Math.max(w1, w2);

  const session: PvpDuelSession = {
    duelId,
    player1: onChain.player1,
    player2: onChain.player2,
    poolWins,
    p1Hand: drawHandWithRng(poolWins, cryptoRng),
    p2Hand: drawHandWithRng(poolWins, cryptoRng),
    round: 1,
    transcript: [],
    roundDeadlineMs: Date.now() + ROUND_DEADLINE_MS,
    expiresAtMs: 0,
  };
  await savePvpSession(session);
  return session;
}

/** Draw a single fresh card for a sudden-death round from the duel's pool. */
export function drawSuddenDeathCard(poolWins: number): Card {
  return drawHandWithRng(poolWins, cryptoRng)[0];
}

function otherSlot(slot: PvpSlot): PvpSlot {
  return slot === "p1" ? "p2" : "p1";
}

/**
 * Record a player's pick for the current round and, once BOTH players have
 * submitted, resolve the round (and any sudden-death rounds) under an exclusive
 * lock so it happens exactly once. Returns the latest session.
 *
 * `alreadyPicked` is true when the player had already submitted this round.
 */
export async function submitPickAndMaybeResolve(
  session: PvpDuelSession,
  slot: PvpSlot,
  card: Card,
): Promise<{ session: PvpDuelSession; alreadyPicked: boolean }> {
  const { duelId, round } = session;
  const placed = await setPvpPickNx(duelId, round, slot, card);

  const [p1Pick, p2Pick] = await Promise.all([
    getPvpPick(duelId, round, "p1"),
    getPvpPick(duelId, round, "p2"),
  ]);

  if (!p1Pick || !p2Pick) {
    return { session, alreadyPicked: !placed };
  }

  // Both in — exactly one caller wins the resolve lock and computes the round.
  const gotLock = await acquireRoundResolveLock(duelId, round);
  if (!gotLock) {
    const latest = (await getPvpSession(duelId)) ?? session;
    return { session: latest, alreadyPicked: !placed };
  }

  let state = determinePvpOutcome(session.transcript);
  state = applyPvpRound(state, p1Pick, p2Pick);

  // Auto-play sudden-death rounds with fresh random cards until decided.
  while (needsSuddenDeath(state)) {
    state = applyPvpRound(
      state,
      drawSuddenDeathCard(session.poolWins),
      drawSuddenDeathCard(session.poolWins),
    );
  }

  session.transcript = state.rounds;
  session.round = state.round;
  session.isOver = state.isOver;
  session.winnerSlot = state.winnerSlot ?? undefined;
  session.roundDeadlineMs = Date.now() + ROUND_DEADLINE_MS;
  await savePvpSession(session);

  return { session, alreadyPicked: !placed };
}

export interface PvpPublicView {
  duelId: string;
  yourSlot: PvpSlot;
  yourHand: Card[];
  usedCardIds: string[];
  round: number;
  isOver: boolean;
  youWon: boolean | null;
  yourHp: number;
  opponentHp: number;
  youSubmitted: boolean;
  opponentSubmitted: boolean;
  roundDeadlineMs: number;
  /** Last fully-resolved round, from the caller's perspective. */
  lastRound: {
    round: number;
    yourCard: Card;
    opponentCard: Card;
    yourDamageDealt: number;
    opponentDamageDealt: number;
    yourHpAfter: number;
    opponentHpAfter: number;
    sudden: boolean;
  } | null;
}

/** Shape the session for one caller — never leaks the opponent's hand or unrevealed pick. */
export async function buildPublicView(
  session: PvpDuelSession,
  slot: PvpSlot,
): Promise<PvpPublicView> {
  const isP1 = slot === "p1";
  const outcome = determinePvpOutcome(session.transcript);
  const yourHp = isP1 ? outcome.p1Hp : outcome.p2Hp;
  const opponentHp = isP1 ? outcome.p2Hp : outcome.p1Hp;

  const usedCardIds = session.transcript
    .map((r) => (isP1 ? r.p1Card.id : r.p2Card.id))
    // sudden-death cards are server-drawn, not from the player's hand
    .filter((id) => (isP1 ? session.p1Hand : session.p2Hand).some((c) => c.id === id));

  const [youPick, oppPick] = await Promise.all([
    getPvpPick(session.duelId, session.round, slot),
    getPvpPick(session.duelId, session.round, otherSlot(slot)),
  ]);

  const last = session.transcript[session.transcript.length - 1] ?? null;
  const lastRound = last
    ? {
        round: last.round,
        yourCard: isP1 ? last.p1Card : last.p2Card,
        opponentCard: isP1 ? last.p2Card : last.p1Card,
        yourDamageDealt: isP1 ? last.p1DamageDealt : last.p2DamageDealt,
        opponentDamageDealt: isP1 ? last.p2DamageDealt : last.p1DamageDealt,
        yourHpAfter: isP1 ? last.p1HpAfter : last.p2HpAfter,
        opponentHpAfter: isP1 ? last.p2HpAfter : last.p1HpAfter,
        sudden: Boolean(last.sudden),
      }
    : null;

  return {
    duelId: session.duelId,
    yourSlot: slot,
    yourHand: isP1 ? session.p1Hand : session.p2Hand,
    usedCardIds,
    round: session.round,
    isOver: Boolean(session.isOver),
    youWon: session.isOver ? session.winnerSlot === slot : null,
    yourHp: session.transcript.length ? yourHp : STARTING_HP,
    opponentHp: session.transcript.length ? opponentHp : STARTING_HP,
    youSubmitted: Boolean(youPick),
    opponentSubmitted: Boolean(oppPick),
    roundDeadlineMs: session.roundDeadlineMs,
    lastRound,
  };
}
