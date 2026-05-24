import { incrRateLimit } from "@/lib/redis";

const LIMITS = {
  "start-duel": { max: 10, windowSeconds: 3600 },
  "ai-move": { max: 30, windowSeconds: 3600 },
  "claim-rewards": { max: 5, windowSeconds: 3600 },
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
    return { allowed: true, count: 0 };
  }

  return { allowed: count <= max, count };
}
