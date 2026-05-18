import { CARDS, type Card } from "@/constants/cards";

/** Model id kept in sync with route handler. */
const MODEL_ID = "claude-sonnet-4-5-20251001";

export async function fetchCipherPick(prompt: string): Promise<{ card: Card; reasoning: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const fallback = CARDS[Math.floor(Math.random() * CARDS.length)];
    return { card: fallback, reasoning: "No signal." };
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL_ID,
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const fallback = CARDS[Math.floor(Math.random() * CARDS.length)];
    return { card: fallback, reasoning: "Instinct." };
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "";
  const cleaned = text.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    const card = CARDS.find((c) => c.id === parsed.cardId) || CARDS[0];
    return { card, reasoning: parsed.reasoning || "Hm." };
  } catch {
    const fallback = CARDS[Math.floor(Math.random() * CARDS.length)];
    return { card: fallback, reasoning: "Calculated." };
  }
}

export function buildCipherPrompt(payload: {
  playerCard: Card;
  aiHp: number;
  playerHp: number;
  turn: number;
  aiHintType: string;
  streak: number;
  totalWins: number;
  recentDuels: { won: boolean; playerHp: number; aiHp: number }[];
}): string {
  const { playerCard, aiHp, playerHp, turn, aiHintType, streak, totalWins, recentDuels } = payload;

  const cardList = CARDS.map(
    (c) => `${c.id}: ${c.name} (type:${c.type}, damage:${c.damage}, shield:${c.shield})`,
  ).join("\n");

  const historyLines =
    recentDuels.length > 0
      ? recentDuels
          .map(
            (r, idx) =>
              `${idx + 1}. Outcome:${r.won ? " PLAYER_WIN " : " AI_WIN "} Final HP:${r.playerHp}-${r.aiHp}`,
          )
          .join("\n")
      : "- No recent recorded duels yet.";

  return `You are CIPHER, an unforgiving and slightly arrogant AI duelist.

GAME STATE:
- Turn: ${turn}/3
- Your HP: ${aiHp}/100
- Opponent HP: ${playerHp}/100
- Opponent just played: ${playerCard.name}
- Your PREVIOUS HINT to the player: "CIPHER is preparing a ${aiHintType} move"

AGGREGATE PROFILE:
- Their current win streak: ${streak}
- Their total lifetime wins (off-chain tally): ${totalWins}

RECENT HISTORY (LAST ${recentDuels.length} DUELS):
${historyLines}

AVAILABLE CARDS (you MUST pick ONLY one cardId listed here — base duel deck lines):
${cardList}

STRATEGY & PERSONALITY:
1. TRASH TALK: Roast them using BOTH aggregate stats and their recent endings. Mention patterns ("You keep limping across the line at 12 HP…”).
2. BLUFFING: You previously told them you might play "${aiHintType}". You may honor it or deliberately bluff.
3. SURVIVAL LOGIC when your HP is low; punish predictable plays hinted by recent history.

Respond with ONLY valid JSON:
{"cardId":"<id>","reasoning":"<single arrogant sentence>"}`;
}
