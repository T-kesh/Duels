import { getRedis, setNxEx } from "@/lib/redis";

const CHALLENGE_TTL_SECONDS = 5 * 60;

function memoryMap(): Map<string, string> {
  const g = globalThis as typeof globalThis & { __START_DUEL_CHALLENGE__?: Map<string, string> };
  if (!g.__START_DUEL_CHALLENGE__) g.__START_DUEL_CHALLENGE__ = new Map();
  return g.__START_DUEL_CHALLENGE__;
}

const key = (address: string) => `startduel:challenge:${address.toLowerCase()}`;

/** Message the wallet signs to prove control of `address` before starting a duel. */
export function startDuelChallengeMessage(address: string, nonce: string): string {
  return `Duels: authenticate to start an AI duel\naddress: ${address.toLowerCase()}\nnonce: ${nonce}`;
}

export async function setStartDuelChallenge(address: string, nonce: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    const ok = await setNxEx(key(address), nonce, CHALLENGE_TTL_SECONDS).catch(() => false);
    // setNxEx uses NX so a stale unclaimed nonce could block a retry; use plain SET+EX here instead.
    if (!ok) {
      await redis.set(key(address), nonce, { ex: CHALLENGE_TTL_SECONDS }).catch(() => undefined);
    }
    return;
  }
  memoryMap().set(key(address), nonce);
}

/** Read and delete the challenge nonce (single use). */
export async function consumeStartDuelChallenge(address: string): Promise<string | undefined> {
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get<string>(key(address));
      if (raw === null || raw === undefined) return undefined;
      await redis.del(key(address)).catch(() => undefined);
      return raw;
    } catch (err) {
      console.warn("[duelAuth] Redis nonce read failed, falling back to memory:", err);
    }
  }
  const map = memoryMap();
  const val = map.get(key(address));
  map.delete(key(address));
  return val;
}