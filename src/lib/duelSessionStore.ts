import type { TurnResult } from "@/lib/gameEngine";
import type { Card } from "@/constants/cards";
import { Redis } from "@upstash/redis";

export interface DuelSession {
  duelId: string;
  /** The three dealt cards for this duel (authoritative server draw). */
  hand: Card[];
  transcript: Pick<TurnResult, "playerCard" | "aiCard">[];
  /** Current HP + turn bookkeeping mirrored from gameEngine (JSON). */
  stateJson: string;
  expiresAtMs: number;
  /** Prevent double issuance of signatures for AI reward mode. */
  rewardSignatureIssued?: boolean;
}

const TTL_SECONDS = 45 * 60; // 45 minutes

/**
 * Returns a Redis client if UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * are set, otherwise falls back to the in-memory Map (local dev without Redis).
 */
function getRedis(): Redis | null {
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return null;
}

// ─── In-memory fallback (local dev only) ─────────────────────────────────────

declare global {
  var __DUEL_AI_SESSION__: Map<string, DuelSession> | undefined;
}

function memoryMap(): Map<string, DuelSession> {
  const g = globalThis as typeof globalThis & {
    __DUEL_AI_SESSION__?: Map<string, DuelSession>;
  };
  if (!g.__DUEL_AI_SESSION__) g.__DUEL_AI_SESSION__ = new Map();
  return g.__DUEL_AI_SESSION__;
}

function sessionKey(duelId: string) {
  return `duel:session:${duelId}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createAiDuelSession(duelId: string): Promise<DuelSession> {
  const session: DuelSession = {
    duelId,
    hand: [],
    transcript: [],
    stateJson: "",
    expiresAtMs: Date.now() + TTL_SECONDS * 1000,
  };

  const redis = getRedis();
  if (redis) {
    await redis.set(sessionKey(duelId), JSON.stringify(session), {
      ex: TTL_SECONDS,
    });
  } else {
    memoryMap().set(duelId, session);
  }

  return session;
}

export async function getAiDuelSession(
  duelId: string | undefined
): Promise<DuelSession | undefined> {
  if (!duelId) return undefined;

  const redis = getRedis();
  if (redis) {
    const raw = await redis.get<string>(sessionKey(duelId));
    if (!raw) return undefined;
    try {
      return typeof raw === "string" ? JSON.parse(raw) : (raw as DuelSession);
    } catch {
      return undefined;
    }
  }

  // Memory fallback
  const map = memoryMap();
  const session = map.get(duelId);
  if (!session) return undefined;
  if (session.expiresAtMs <= Date.now()) {
    map.delete(duelId);
    return undefined;
  }
  return session;
}

export async function saveAiDuelSession(session: DuelSession): Promise<void> {
  // Refresh TTL on every write
  session.expiresAtMs = Date.now() + TTL_SECONDS * 1000;

  const redis = getRedis();
  if (redis) {
    await redis.set(sessionKey(session.duelId), JSON.stringify(session), {
      ex: TTL_SECONDS,
    });
  } else {
    memoryMap().set(session.duelId, session);
  }
}

/** @deprecated use saveAiDuelSession instead */
export async function touchSession(session: DuelSession): Promise<void> {
  return saveAiDuelSession(session);
}
