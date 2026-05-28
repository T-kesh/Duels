import { Redis } from "@upstash/redis";

let redisClient: Redis | null | undefined;

/** Shared Upstash client; null when env vars are unset (local dev memory fallback). */
export function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    redisClient = new Redis({ url, token });
  } else {
    redisClient = null;
  }
  return redisClient;
}

/**
 * Run a Redis operation and return its result, or null on any error.
 * This allows callers to fall back to in-memory storage when Redis is
 * misconfigured, unreachable, or returns an auth error.
 */
export async function safeRedisOp<T>(op: () => Promise<T>): Promise<T | null> {
  try {
    return await op();
  } catch (err) {
    console.warn("[redis] operation failed, falling back to memory:", err);
    return null;
  }
}

/** SET key only if absent; returns true when the key was set. */
export async function setNxEx(
  key: string,
  value: string,
  exSeconds: number,
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const result = await safeRedisOp(() => redis.set(key, value, { nx: true, ex: exSeconds }));
  return result === "OK";
}

/** Increment a counter with TTL (creates key if missing). */
export async function incrRateLimit(
  key: string,
  windowSeconds: number,
): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;

  const count = await safeRedisOp(async () => {
    const c = await redis.incr(key);
    if (c === 1) await redis.expire(key, windowSeconds);
    return c;
  });

  return count ?? 0;
}
