import { getRedis, safeRedisOp } from "@/lib/redis";

export const MAX_LIVES = 5;
export const RECHARGE_TIME_MS = 4 * 60 * 60 * 1000;

export interface PlayerEnergy {
  lives: number;
  bonusLives: number;
  lastRechargeMs: number;
}

export interface PlayerState {
  energy: PlayerEnergy;
  totalWins: number;
  nextRechargeAt: number | null;
}

interface StoredPlayer {
  lives: number;
  bonusLives: number;
  lastRechargeMs: number;
  totalWins: number;
  /** Consecutive AI-duel wins, server-authoritative (reward tiers key on it). */
  winStreak?: number;
}

function memoryPlayers(): Map<string, StoredPlayer> {
  const g = globalThis as typeof globalThis & { __DUEL_PLAYER_STORE__?: Map<string, StoredPlayer> };
  if (!g.__DUEL_PLAYER_STORE__) g.__DUEL_PLAYER_STORE__ = new Map();
  return g.__DUEL_PLAYER_STORE__;
}

function playerKey(address: string) {
  return `player:${address.toLowerCase()}`;
}

function defaultStored(): StoredPlayer {
  return {
    lives: MAX_LIVES,
    bonusLives: 0,
    lastRechargeMs: Date.now(),
    totalWins: 0,
  };
}

async function loadStored(address: string): Promise<StoredPlayer> {
  const redis = getRedis();
  const key = playerKey(address);

  if (redis) {
    // Read inside its own try/catch so we can distinguish a genuinely MISSING
    // key (Upstash returns null/undefined → seed a fresh record) from a Redis
    // ERROR (throws → fall through to the in-memory store). safeRedisOp would
    // collapse both to null, which previously made the seed branch dead code
    // and silently reset existing players to full energy on transient errors.
    try {
      const raw = await redis.get<string | StoredPlayer>(key);

      if (raw === null || raw === undefined) {
        const fresh = defaultStored();
        await safeRedisOp(() => redis.set(key, JSON.stringify(fresh)));
        return fresh;
      }

      if (typeof raw === "string") {
        try {
          return JSON.parse(raw) as StoredPlayer;
        } catch {
          return defaultStored();
        }
      }

      return raw as StoredPlayer;
    } catch (err) {
      console.warn("[playerStore] Redis read failed, falling back to memory:", err);
      // fall through to memory
    }
  }

  const map = memoryPlayers();
  if (!map.has(key)) map.set(key, defaultStored());
  return { ...map.get(key)! };
}

async function saveStored(address: string, data: StoredPlayer): Promise<void> {
  const redis = getRedis();
  const key = playerKey(address);

  if (redis) {
    const ok = await safeRedisOp(() => redis.set(key, JSON.stringify(data)));
    if (ok !== null) return;
  }
  memoryPlayers().set(key, { ...data });
}

function applyRecharge(data: StoredPlayer, now = Date.now()): PlayerState {
  let lives = data.lives;
  let lastRechargeMs = data.lastRechargeMs;
  let nextRechargeAt: number | null = null;

  if (lives >= MAX_LIVES) {
    lives = MAX_LIVES;
    nextRechargeAt = null;
  } else {
    const elapsed = now - lastRechargeMs;
    const gained = Math.floor(elapsed / RECHARGE_TIME_MS);
    if (gained > 0) {
      lives = Math.min(MAX_LIVES, lives + gained);
      if (lives >= MAX_LIVES) {
        lastRechargeMs = now;
        nextRechargeAt = null;
      } else {
        lastRechargeMs = lastRechargeMs + gained * RECHARGE_TIME_MS;
      }
    }
    if (lives < MAX_LIVES) {
      const remaining = RECHARGE_TIME_MS - (now - lastRechargeMs);
      nextRechargeAt = now + remaining;
    }
  }

  return {
    energy: {
      lives,
      bonusLives: data.bonusLives,
      lastRechargeMs,
    },
    totalWins: data.totalWins,
    nextRechargeAt,
  };
}

export async function getPlayerState(address: string): Promise<PlayerState> {
  const stored = await loadStored(address);
  const state = applyRecharge(stored);
  await saveStored(address, {
    ...stored,
    lives: state.energy.lives,
    lastRechargeMs: state.energy.lastRechargeMs,
  });
  return state;
}

export async function consumeLife(address: string): Promise<{ ok: boolean; state: PlayerState }> {
  const stored = await loadStored(address);
  const state = applyRecharge(stored);

  if (state.energy.bonusLives > 0) {
    stored.bonusLives = state.energy.bonusLives - 1;
    stored.lives = state.energy.lives;
    stored.lastRechargeMs = state.energy.lastRechargeMs;
    await saveStored(address, stored);
    return { ok: true, state: await getPlayerState(address) };
  }

  if (state.energy.lives <= 0) {
    return { ok: false, state };
  }

  const wasFull = state.energy.lives >= MAX_LIVES;
  stored.lives = state.energy.lives - 1;
  stored.bonusLives = state.energy.bonusLives;
  stored.lastRechargeMs = wasFull ? Date.now() : state.energy.lastRechargeMs;
  await saveStored(address, stored);

  return { ok: true, state: await getPlayerState(address) };
}

export async function grantBonus(address: string, amount = 1): Promise<PlayerState> {
  const stored = await loadStored(address);
  stored.bonusLives += amount;
  await saveStored(address, stored);
  return getPlayerState(address);
}

/** Read-only lifetime win count — does not recharge energy or write back. */
export async function getTotalWins(address: string): Promise<number> {
  const stored = await loadStored(address);
  return stored.totalWins;
}

export async function incrementWins(address: string): Promise<number> {
  const stored = await loadStored(address);
  stored.totalWins += 1;
  stored.winStreak = (stored.winStreak ?? 0) + 1;
  await saveStored(address, stored);
  return stored.totalWins;
}

/** Reset the win streak after a lost AI duel. */
export async function resetWinStreak(address: string): Promise<void> {
  const stored = await loadStored(address);
  if ((stored.winStreak ?? 0) === 0) return;
  stored.winStreak = 0;
  await saveStored(address, stored);
}

/** Server-authoritative consecutive-win count (includes the latest win). */
export async function getWinStreak(address: string): Promise<number> {
  const stored = await loadStored(address);
  return stored.winStreak ?? 0;
}

export async function grantPerfectDuelBonus(address: string): Promise<void> {
  await grantBonus(address, 1);
}
