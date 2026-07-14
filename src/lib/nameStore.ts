import { getRedis, safeRedisOp } from "@/lib/redis";

export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 16;

// Letters, digits, underscores only — keeps names render-safe and blocks
// whitespace/homoglyph tricks aimed at impersonating other players.
const NAME_REGEX = /^[A-Za-z0-9_]{3,16}$/;

export type SetNameResult =
  | { ok: true; name: string }
  | { ok: false; error: "invalid_name" | "name_taken" | "store_unavailable" };

/** Trim and validate a raw display name; null when it doesn't conform. */
export function normalizeDisplayName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return NAME_REGEX.test(trimmed) ? trimmed : null;
}

// Forward: address → display name (as typed).
// Reverse: lowercased name → owning address, for case-insensitive uniqueness.
const nameKey = (address: string) => `name:${address.toLowerCase()}`;
const ownerKey = (name: string) => `nameowner:${name.toLowerCase()}`;

function memoryNames(): Map<string, string> {
  const g = globalThis as typeof globalThis & { __DUEL_NAME_STORE__?: Map<string, string> };
  if (!g.__DUEL_NAME_STORE__) g.__DUEL_NAME_STORE__ = new Map();
  return g.__DUEL_NAME_STORE__;
}

function memoryOwners(): Map<string, string> {
  const g = globalThis as typeof globalThis & { __DUEL_NAME_OWNER__?: Map<string, string> };
  if (!g.__DUEL_NAME_OWNER__) g.__DUEL_NAME_OWNER__ = new Map();
  return g.__DUEL_NAME_OWNER__;
}

/**
 * Claim `name` for `address`, first-come-first-served on the lowercased name.
 * Re-claiming your own name (e.g. changing case) is allowed; switching names
 * releases the previously held one.
 */
export async function setName(address: string, rawName: unknown): Promise<SetNameResult> {
  const name = normalizeDisplayName(rawName);
  if (!name) return { ok: false, error: "invalid_name" };

  const addr = address.toLowerCase();
  const redis = getRedis();

  if (redis) {
    // NX claim on the reverse key is the uniqueness gate: only one address
    // can ever hold a given lowercased name at a time.
    const claimed = await safeRedisOp(() =>
      redis.set(ownerKey(name), addr, { nx: true }),
    );

    if (claimed !== "OK") {
      const owner = await safeRedisOp(() => redis.get<string>(ownerKey(name)));
      if (owner === null || owner === undefined) {
        // Claim failed yet no owner readable — Redis error, not a conflict.
        return { ok: false, error: "store_unavailable" };
      }
      if (owner !== addr) return { ok: false, error: "name_taken" };
      // owner === addr: re-setting our own name (case tweak) — fall through.
    }

    // Release the old name's reverse key when switching to a different name.
    const oldRaw = await safeRedisOp(() => redis.get<unknown>(nameKey(addr)));
    const old = typeof oldRaw === "string" ? oldRaw : null;
    if (old && old.toLowerCase() !== name.toLowerCase()) {
      await safeRedisOp(() => redis.del(ownerKey(old)));
    }

    // JSON-encode so Upstash's auto-deserialization can't mangle names that
    // parse as JSON scalars ("null", "true", all-digit names).
    const saved = await safeRedisOp(() => redis.set(nameKey(addr), JSON.stringify(name)));
    if (saved === null) {
      // Reverse key is ours but forward write failed; a retry self-heals
      // because the owner check above lets us pass.
      return { ok: false, error: "store_unavailable" };
    }
    return { ok: true, name };
  }

  const owners = memoryOwners();
  const names = memoryNames();
  const lower = name.toLowerCase();

  const owner = owners.get(lower);
  if (owner && owner !== addr) return { ok: false, error: "name_taken" };

  const old = names.get(nameKey(addr));
  if (old && old.toLowerCase() !== lower) owners.delete(old.toLowerCase());

  owners.set(lower, addr);
  names.set(nameKey(addr), name);
  return { ok: true, name };
}

/** Batch-resolve display names. Returns a map of lowercased address → name. */
export async function getNames(addresses: string[]): Promise<Record<string, string>> {
  const addrs = [...new Set(addresses.map((a) => a.toLowerCase()))];
  if (addrs.length === 0) return {};

  const redis = getRedis();
  const result: Record<string, string> = {};

  if (redis) {
    const values = await safeRedisOp(() => redis.mget<unknown[]>(...addrs.map(nameKey)));
    if (values) {
      addrs.forEach((addr, i) => {
        const v = values[i];
        // Values were JSON.stringify'd strings; Upstash hands them back parsed.
        if (typeof v === "string" && v.length > 0) result[addr] = v;
      });
    }
    return result;
  }

  const names = memoryNames();
  for (const addr of addrs) {
    const v = names.get(nameKey(addr));
    if (v) result[addr] = v;
  }
  return result;
}
