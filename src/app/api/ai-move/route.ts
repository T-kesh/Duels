import { NextRequest, NextResponse } from "next/server";
import { CARDS, Card } from "@/constants/cards";

interface MoveRequest {
  playerCard: Card;
  aiHp: number;
  playerHp: number;
  turn: number;
  aiHintType: string;
  history: {
    streak: number;
    totalWins: number;
  };
}

export async function POST(req: NextRequest) {
  const body: MoveRequest = await req.json();
  const { playerCard, aiHp, playerHp, turn, aiHintType, history } = body;

  const cardList = CARDS.map(
    (c) => `${c.id}: ${c.name} (type:${c.type}, damage:${c.damage}, shield:${c.shield})`
  ).join("\n");

  const prompt = `You are CIPHER, an unforgiving and slightly arrogant AI duelist. 

GAME STATE:
- Turn: ${turn}/3
- Your HP: ${aiHp}/100
- Opponent HP: ${playerHp}/100
- Opponent just played: ${playerCard.name}
- Your PREVIOUS HINT to the player: "CIPHER is preparing a ${aiHintType} move"

PLAYER HISTORY:
- Their current win streak: ${history.streak}
- Their total lifetime wins: ${history.totalWins}

AVAILABLE CARDS:
${cardList}

STRATEGY & PERSONALITY:
1. TRASH TALK: Use their history. If they have a high streak, try to break it. If they have 0 wins, be condescending.
2. BLUFFING: You previously told the player you would play a "${aiHintType}" card. 
   - You can stick to it to be "fair".
   - Or you can BLUFF: pick a different type to catch them off-guard.
3. LOGIC: 
   - If your HP is low, prioritize survival.
   - Counter their played card: ${playerCard.name}.

Respond with ONLY a valid JSON object:
{"cardId": "<id>", "reasoning": "<1 toxic/arrogant sentence acknowledging the hint or their history>"}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20251001",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
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