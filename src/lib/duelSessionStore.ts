import type { TurnResult } from "@/lib/gameEngine";
import type { Card } from "@/constants/cards";

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

declare global {
  var __DUEL_AI_SESSION__: Map<string, DuelSession> | undefined;
}

const TTL_MS = 45 * 60 * 1000;

function backingMap(): Map<string, DuelSession> {
  const g = globalThis as typeof globalThis & { __DUEL_AI_SESSION__?: Map<string, DuelSession> };
  if (!g.__DUEL_AI_SESSION__) {
    g.__DUEL_AI_SESSION__ = new Map();
  }
  return g.__DUEL_AI_SESSION__;
}

function sweepExpired(map: Map<string, DuelSession>, now = Date.now()) {
  for (const [key, session] of map) {
    if (session.expiresAtMs <= now) map.delete(key);
  }
}

export function createAiDuelSession(duelId: string): DuelSession {
  const map = backingMap();
  sweepExpired(map);
  const session: DuelSession = {
    duelId,
    hand: [],
    transcript: [],
    stateJson: "",
    expiresAtMs: Date.now() + TTL_MS,
  };
  map.set(duelId, session);
  return session;
}

export function touchSession(session: DuelSession) {
  session.expiresAtMs = Date.now() + TTL_MS;
}

export function getAiDuelSession(duelId: string | undefined): DuelSession | undefined {
  if (!duelId) return undefined;
  const map = backingMap();
  sweepExpired(map);
  return map.get(duelId);
}
