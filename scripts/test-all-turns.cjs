require("dotenv").config({ path: ".env.local" });

async function playAllTurns() {
  console.log("Starting duel...");
  const startRes = await fetch("http://localhost:3000/api/start-duel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerAddress: "0x1234567890123456789012345678901234567890" })
  });
  const startData = await startRes.json();
  if (!startRes.ok) { console.error("Start failed:", startData); return; }
  
  let duelId = startData.duelId;
  let hand = startData.hand;
  
  for (let i = 0; i < 3; i++) {
    console.log(`\nPlaying Turn ${i + 1}... with card ${hand[i].id}`);
    const moveRes = await fetch("http://localhost:3000/api/ai-move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        duelId: duelId,
        playerCard: hand[i],
        aiHintType: "attack",
        history: { streak: 0, totalWins: 0 },
        recentDuels: []
      })
    });
    const moveData = await moveRes.json();
    console.log(`Response status: ${moveRes.status}`);
    if (!moveRes.ok) {
      console.error("Error:", moveData.error);
      break;
    } else {
      console.log(`AI played: ${moveData.card.id}, Is Over: ${moveData.state.isOver}`);
    }
  }
}

playAllTurns();
