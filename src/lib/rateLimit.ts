import { incrRateLimit } from "@/lib/redis";

const LIMITS = {
  "start-duel": { max: 10, windowSeconds: 3600 },
  "start-duel-auth": { max: 20, windowSeconds: 3600 },
  "ai-move": { max: 30, windowSeconds: 3600 },
  "claim-rewards": { max: 5, windowSeconds: 3600 },
  "profile-auth": { max: 20, windowSeconds: 3600 },
  "profile-set": { max: 10, windowSeconds: 3600 },
  "names-lookup": { max: 120, windowSeconds: 3600 },
  "pvp-auth": { max: 20, windowSeconds: 3600 },
  "pvp-move": { max: 120, windowSeconds: 3600 },
  "pvp-state": { max: 600, windowSeconds: 3600 },
  "pvp-claim": { max: 10, windowSeconds: 3600 },
} as const;

export type RateLimitRoute = keyof typeof LIMITS;

export async function checkRateLimit(
  route: RateLimitRoute,
  address: string,
): Promise<{ allowed: boolean; count: number }> {
  const { max, windowSeconds } = LIMITS[route];
  const key = `ratelimit:${route}:${address.toLowerCase()}`;
  const count = await incrRateLimit(key, windowSeconds);

  if (count === 0) {
    // Redis unavailable — rate limiting is bypassed (fail-open).
    // This is acceptable in local dev but should be alerted in production.
    if (process.env.NODE_ENV === "production") {
      console.warn(`[rateLimit] Redis unavailable — ${route} limit bypassed for ${address}`);
    }
    return { allowed: true, count: 0 };
  }

  return { allowed: count <= max, count };
}
