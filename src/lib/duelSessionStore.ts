import type { TurnResult } from "@/lib/gameEngine";
import type { Card } from "@/constants/cards";
import { getRedis, safeRedisOp } from "@/lib/redis";

export type AiHintType = "attack" | "defend" | "special";

export interface DuelSession {
  duelId: string;
  /** Wallet that started this duel (required for claims). */
  playerAddress: string;
  /** The three dealt cards for this duel (authoritative server draw). */
  hand: Card[];
  transcript: (Pick<TurnResult, "playerCard" | "aiCard"> & { aiHintType?: AiHintType })[];
  /** Current HP + turn bookkeeping mirrored from gameEngine (JSON). */
  stateJson: string;
  expiresAtMs: number;
  /** Hint shown to player this pick phase; validated on ai-move. */
  lastAiHintType?: AiHintType;
  /** Prevent double issuance of signatures for AI reward mode. */
  rewardSignatureIssued?: boolean;
  rewardDecision?: {
    tier: string;
    amountWei: string;
    flavor: string;
  };
  rewardNonce?: string;
  rewardSignature?: string;
}

const TTL_SECONDS = 45 * 60; // 45 minutes

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

export async function createAiDuelSession(
  duelId: string,
  playerAddress: string,
): Promise<DuelSession> {
  const session: DuelSession = {
    duelId,
    playerAddress: playerAddress.toLowerCase(),
    hand: [],
    transcript: [],
    stateJson: "",
    expiresAtMs: Date.now() + TTL_SECONDS * 1000,
  };

  const redis = getRedis();
  if (redis) {
    const ok = await safeRedisOp(() =>
      redis.set(sessionKey(duelId), JSON.stringify(session), { ex: TTL_SECONDS }),
    );
    if (ok !== null) return session;
  }
  memoryMap().set(duelId, session);
  return session;
}

export async function getAiDuelSession(
  duelId: string | undefined,
): Promise<DuelSession | undefined> {
  if (!duelId) return undefined;

  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get<string | DuelSession>(sessionKey(duelId));
      if (raw === null || raw === undefined) return undefined;
      return typeof raw === "string" ? (JSON.parse(raw) as DuelSession) : raw;
    } catch (err) {
      console.warn("[duelSessionStore] Redis read failed, falling back to memory:", err);
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

export async function saveAiDuelSession(session: DuelSession): Promise<void> {
  session.expiresAtMs = Date.now() + TTL_SECONDS * 1000;

  const redis = getRedis();
  if (redis) {
    const ok = await safeRedisOp(() =>
      redis.set(sessionKey(session.duelId), JSON.stringify(session), { ex: TTL_SECONDS }),
    );
    if (ok !== null) return;
  }
  memoryMap().set(session.duelId, session);
}

/** @deprecated use saveAiDuelSession instead */
export async function touchSession(session: DuelSession): Promise<void> {
  return saveAiDuelSession(session);
}
