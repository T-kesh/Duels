const STORAGE_KEY = "duel_recent_results";

export type RecentDuelResult = {
  won: boolean;
  playerHp: number;
  aiHp: number;
  at: number;
};

/** Last N duel outcomes stored locally for CIPHER "memory". */
export function readRecentDuels(max = 3): RecentDuelResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cleaned = parsed
      .filter(
        (r) =>
          r &&
          typeof r.won === "boolean" &&
          typeof r.playerHp === "number" &&
          typeof r.aiHp === "number" &&
          typeof r.at === "number",
      )
      .sort((a, b) => b.at - a.at);
    return cleaned.slice(0, max);
  } catch {
    return [];
  }
}

export function pushRecentDuelOutcome(result: Omit<RecentDuelResult, "at">): void {
  if (typeof window === "undefined") return;
  const entry: RecentDuelResult = { ...result, at: Date.now() };

  let prev: RecentDuelResult[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) prev = parsed;
    }
  } catch {
    prev = [];
  }

  const merged = [entry, ...prev].slice(0, 10);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}
