import type { Card } from "@/constants/cards";
import type { PvpResolvedRound, PvpSlot } from "@/lib/pvpGameEngine";
import { getRedis, safeRedisOp, setNxEx } from "@/lib/redis";

/**
 * Server-authoritative PvP session, keyed by the ON-CHAIN numeric duelId so the
 * signed `resolveDuel` payload references the same id the contract escrows. The
 * two participants and wager come from the chain (`duels(duelId)`), never from
 * the client. Hands are dealt server-side and hidden from the opponent.
 */
export interface PvpDuelSession {
  duelId: string; // on-chain numeric id (string form)
  player1: string; // lowercased, from chain
  player2: string; // lowercased, from chain
  /** Win count used to size the (equal) card pool both players draw from. */
  poolWins: number;
  p1Hand: Card[];
  p2Hand: Card[];
  /** Current round awaiting picks (1-based). */
  round: number;
  /** Resolved rounds, replayable for claim verification. */
  transcript: PvpResolvedRound[];
  /** Forfeit deadline (ms epoch) for the current round. */
  roundDeadlineMs: number;
  winnerSlot?: PvpSlot;
  isOver?: boolean;
  resolveSignatureIssued?: boolean;
  expiresAtMs: number;
}

const TTL_SECONDS = 45 * 60; // 45 minutes, matching the AI duel session
/** Per-round move deadline; a no-show past this lets the opponent claim a forfeit. */
export const ROUND_DEADLINE_MS = 90 * 1000;

function memoryMap(): Map<string, PvpDuelSession> {
  const g = globalThis as typeof globalThis & {
    __DUEL_PVP_SESSION__?: Map<string, PvpDuelSession>;
  };
  if (!g.__DUEL_PVP_SESSION__) g.__DUEL_PVP_SESSION__ = new Map();
  return g.__DUEL_PVP_SESSION__;
}

export function pvpSessionKey(duelId: string) {
  return `pvp:session:${duelId}`;
}

export async function getPvpSession(
  duelId: string | undefined,
): Promise<PvpDuelSession | undefined> {
  if (!duelId) return undefined;

  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get<string | PvpDuelSession>(pvpSessionKey(duelId));
      if (raw === null || raw === undefined) return undefined;
      const session = typeof raw === "string" ? (JSON.parse(raw) as PvpDuelSession) : raw;
      return session;
    } catch (err) {
      console.warn("[pvpSessionStore] Redis read failed, falling back to memory:", err);
      // fall through to memory
    }
  }

  const map = memoryMap();
  const session = map.get(duelId);
  if (!session) return undefined;
  if (session.expiresAtMs <= Date.now()) {
    map.delete(duelId);
    return undefined;
  }
  return session;
}

export async function savePvpSession(session: PvpDuelSession): Promise<void> {
  session.expiresAtMs = Date.now() + TTL_SECONDS * 1000;

  const redis = getRedis();
  if (redis) {
    const ok = await safeRedisOp(() =>
      redis.set(pvpSessionKey(session.duelId), JSON.stringify(session), { ex: TTL_SECONDS }),
    );
    if (ok !== null) return;
  }
  memoryMap().set(session.duelId, session);
}

// ─── Auth tokens & per-round picks ───────────────────────────────────────────
// Stored as independent keys (not inside the session blob) so two players acting
// at the same time never clobber each other via read-modify-write on the session.

function memoryKV(): Map<string, string> {
  const g = globalThis as typeof globalThis & { __DUEL_PVP_KV__?: Map<string, string> };
  if (!g.__DUEL_PVP_KV__) g.__DUEL_PVP_KV__ = new Map();
  return g.__DUEL_PVP_KV__;
}

const tokenKey = (duelId: string, slot: PvpSlot) => `pvp:token:${duelId}:${slot}`;
const pickKey = (duelId: string, round: number, slot: PvpSlot) =>
  `pvp:pick:${duelId}:${round}:${slot}`;

export async function setPvpToken(duelId: string, slot: PvpSlot, hash: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    const ok = await safeRedisOp(() => redis.set(tokenKey(duelId, slot), hash, { ex: TTL_SECONDS }));
    if (ok !== null) return;
  }
  memoryKV().set(tokenKey(duelId, slot), hash);
}

export async function getPvpToken(duelId: string, slot: PvpSlot): Promise<string | undefined> {
  const redis = getRedis();
  if (redis) {
    const raw = await safeRedisOp(() => redis.get<string>(tokenKey(duelId, slot)));
    if (raw !== null) return raw ?? undefined;
  }
  return memoryKV().get(tokenKey(duelId, slot));
}

/** Atomically record a player's pick for a round. Returns false if already set. */
export async function setPvpPickNx(
  duelId: string,
  round: number,
  slot: PvpSlot,
  card: Card,
): Promise<boolean> {
  const value = JSON.stringify(card);
  const redis = getRedis();
  if (redis) {
    return setNxEx(pickKey(duelId, round, slot), value, TTL_SECONDS);
  }
  const kv = memoryKV();
  const key = pickKey(duelId, round, slot);
  if (kv.has(key)) return false;
  kv.set(key, value);
  return true;
}

export async function getPvpPick(
  duelId: string,
  round: number,
  slot: PvpSlot,
): Promise<Card | undefined> {
  const redis = getRedis();
  let raw: string | null | undefined;
  if (redis) {
    raw = await safeRedisOp(() => redis.get<string>(pickKey(duelId, round, slot)));
    if (raw === null) raw = memoryKV().get(pickKey(duelId, round, slot));
  } else {
    raw = memoryKV().get(pickKey(duelId, round, slot));
  }
  if (!raw) return undefined;
  try {
    return typeof raw === "string" ? (JSON.parse(raw) as Card) : (raw as Card);
  } catch {
    return undefined;
  }
}

/**
 * Acquire the exclusive right to resolve a given round. Only the caller that
 * receives `true` should compute and persist the round result. When Redis is
 * absent (single-process dev) resolution is effectively serialized already, so
 * we grant the lock.
 */
export async function acquireRoundResolveLock(duelId: string, round: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  return setNxEx(`pvp:resolve:${duelId}:${round}`, "1", TTL_SECONDS);
}

// ─── Auth challenge nonces (one-time, short-lived) ───────────────────────────

const CHALLENGE_TTL_SECONDS = 5 * 60;
const challengeKey = (duelId: string, address: string) =>
  `pvp:challenge:${duelId}:${address.toLowerCase()}`;

export async function setChallengeNonce(
  duelId: string,
  address: string,
  nonce: string,
): Promise<void> {
  const key = challengeKey(duelId, address);
  const redis = getRedis();
  if (redis) {
    const ok = await safeRedisOp(() => redis.set(key, nonce, { ex: CHALLENGE_TTL_SECONDS }));
    if (ok !== null) return;
  }
  memoryKV().set(key, nonce);
}

/** Read and delete the challenge nonce (single use). */
export async function consumeChallengeNonce(
  duelId: string,
  address: string,
): Promise<string | undefined> {
  const key = challengeKey(duelId, address);
  const redis = getRedis();
  if (redis) {
    const raw = await safeRedisOp(() => redis.get<string>(key));
    if (raw !== null) {
      await safeRedisOp(() => redis.del(key));
      return raw ?? undefined;
    }
  }
  const kv = memoryKV();
  const val = kv.get(key);
  kv.delete(key);
  return val;
}
