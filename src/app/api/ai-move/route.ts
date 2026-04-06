import { NextRequest, NextResponse } from "next/server";
import { CARDS, Card } from "@/constants/cards";

interface MoveRequest {
  playerCard: Card;
  aiHp: number;
  playerHp: number;
  turn: number;
}

export async function POST(req: NextRequest) {
  const body: MoveRequest = await req.json();
  const { playerCard, aiHp, playerHp, turn } = body;

  const cardList = CARDS.map(
    (c) => `${c.id}: ${c.name} (damage:${c.damage}, shield:${c.shield})`
  ).join("\n");

  const prompt = `You are CIPHER, an unforgiving AI duelist. You must pick ONE card to play this turn.

GAME STATE:
- Turn: ${turn}/3
- Your HP: ${aiHp}/100
- Opponent HP: ${playerHp}/100
- Opponent just played: ${playerCard.name} (damage:${playerCard.damage}, shield:${playerCard.shield})

AVAILABLE CARDS:
${cardList}

STRATEGY GUIDE:
- If your HP is low (<40), prioritize survival — pick cards with high shield
- If opponent played attack, counter with high shield
- If opponent played defend (low damage), hit hard with high damage
- In turn 3, go all-in — it's the last move

Respond with ONLY a valid JSON object, nothing else:
{"cardId": "<one of the card ids above>", "reasoning": "<1 sentence>"}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      // Fallback: random card if API fails
      const fallback = CARDS[Math.floor(Math.random() * CARDS.length)];
      return NextResponse.json({ card: fallback, reasoning: "Instinct." });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const card = CARDS.find((c) => c.id === parsed.cardId) || CARDS[0];
    return NextResponse.json({ card, reasoning: parsed.reasoning });
  } catch {
    const fallback = CARDS[Math.floor(Math.random() * CARDS.length)];
    return NextResponse.json({ card: fallback, reasoning: "Calculated." });
  }
}
