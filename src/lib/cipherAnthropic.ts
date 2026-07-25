import type { Card } from "@/constants/cards";

// CIPHER only writes a one-line trash-talk/reasoning string — the actual
// card choice is decided server-side in cipherStrategy.ts — so the cheapest
// fast model is the right fit.
const MODEL_ID = "claude-haiku-4-5";

const FALLBACK_LINES = [
  "Calculated.",
  "Instinct.",
  "Your patterns betray you.",
  "CIPHER does not explain itself.",
  "Predictable.",
];

function fallbackLine(): string {
  return FALLBACK_LINES[Math.floor(Math.random() * FALLBACK_LINES.length)];
}

/** Clamp a client-adjacent number into a sane range before it nears a prompt. */
export function clampInt(raw: unknown, min: number, max: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/**
 * Sanitize text inputs before prompt interpolation to neutralize prompt injection vectors.
 * Strips control characters, newlines, system tags ([INST], <system>, etc.), and caps length.
 */
export function sanitizePromptString(raw: unknown, maxLen = 50): string {
  if (typeof raw !== "string") return "Card";
  const cleaned = raw
    // Strip control characters & newlines
    .replace(/[\x00-\x1F\x7F-\x9F\r\n\t]/g, " ")
    // Neutralize prompt instruction tags & special delimiters
    .replace(/\[\/?INST\]|<[^>]*>|Human:|Assistant:|System:/gi, "")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "Card";
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

export interface CipherFlavorContext {
  /** Card CIPHER already decided to play (server-picked). */
  aiCard: Card;
  /** Card the player just played (server-resolved from the dealt hand). */
  playerCard: Card;
  playerHp: number;
  aiHp: number;
  turn: number;
  /** Server-tracked stats — never client input. */
  streak: number;
  totalWins: number;
}

/**
 * Ask the LLM for CIPHER's one-line voice. Everything in the prompt is
 * server-derived, sanitized, and numerically clamped.
 */
export async function fetchCipherFlavor(ctx: CipherFlavorContext): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackLine();

  const playerCardName = sanitizePromptString(ctx.playerCard?.name);
  const aiCardName = sanitizePromptString(ctx.aiCard?.name);

  const prompt = `You are CIPHER, an unforgiving and slightly arrogant AI duelist in a 3-turn card game.

Turn ${clampInt(ctx.turn, 1, 3)}/3. Your HP: ${clampInt(ctx.aiHp, 0, 100)}/100. Opponent HP: ${clampInt(ctx.playerHp, 0, 100)}/100.
Opponent played ${playerCardName}. You are playing ${aiCardName}.
Opponent's current win streak: ${clampInt(ctx.streak, 0, 999)}. Lifetime wins: ${clampInt(ctx.totalWins, 0, 99999)}.

Reply with ONE arrogant in-character sentence (max 18 words) reacting to this exchange. No quotes, no JSON, no preamble.`;

  try {
    const baseUrl = (process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com").replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL_ID,
        max_tokens: 60,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      // Log loudly: a bad model id or auth failure here silently degrades
      // CIPHER's voice to canned lines and should be noticed.
      console.error(`[cipher] Anthropic API ${response.status}: ${await response.text().catch(() => "")}`);
      return fallbackLine();
    }

    const data = await response.json();
    const text: string = data.content?.[0]?.text ?? "";
    const line = text.replace(/\s+/g, " ").replace(/^["'\s]+|["'\s]+$/g, "").trim();
    if (!line) return fallbackLine();
    return line.length > 140 ? `${line.slice(0, 137)}…` : line;
  } catch (err) {
    console.error("[cipher] flavor request failed:", err);
    return fallbackLine();
  }
}
