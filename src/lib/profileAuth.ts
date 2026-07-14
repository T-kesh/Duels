import { getRedis } from "@/lib/redis";

const CHALLENGE_TTL_SECONDS = 5 * 60;

function memoryMap(): Map<string, string> {
  const g = globalThis as typeof globalThis & { __PROFILE_CHALLENGE__?: Map<string, string> };
  if (!g.__PROFILE_CHALLENGE__) g.__PROFILE_CHALLENGE__ = new Map();
  return g.__PROFILE_CHALLENGE__;
}

const key = (address: string) => `profile:challenge:${address.toLowerCase()}`;

/**
 * Message the wallet signs to prove control of `address` before setting a
 * display name. Includes the name itself so a captured signature can't be
 * replayed to set a different name.
 */
export function profileChallengeMessage(address: string, name: string, nonce: string): string {
  return `Duels: set display name\naddress: ${address.toLowerCase()}\nname: ${name}\nnonce: ${nonce}`;
}

export async function setProfileChallenge(address: string, nonce: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(key(address), nonce, { ex: CHALLENGE_TTL_SECONDS }).catch(() => undefined);
    return;
  }
  memoryMap().set(key(address), nonce);
}

/** Read and delete the challenge nonce (single use). */
export async function consumeProfileChallenge(address: string): Promise<string | undefined> {
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get<string>(key(address));
      if (raw === null || raw === undefined) return undefined;
      await redis.del(key(address)).catch(() => undefined);
      return raw;
    } catch (err) {
      console.warn("[profileAuth] Redis nonce read failed, falling back to memory:", err);
    }
  }
  const map = memoryMap();
  const val = map.get(key(address));
  map.delete(key(address));
  return val;
}
