require("dotenv").config({ path: ".env.local" });

async function testGameFlow() {
  console.log("Starting duel...");
  const startRes = await fetch("http://localhost:3000/api/start-duel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerAddress: "0x1234567890123456789012345678901234567890" })
  });

  const startData = await startRes.json();
  console.log("Start duel response status:", startRes.status);
  
  if (!startRes.ok) {
    console.error("Start failed:", startData);
    return;
  }

  console.log("Duel ID:", startData.duelId);
  console.log("Hand:", startData.hand.map(c => c.id).join(", "));

  console.log("\nMaking AI move...");
  const moveRes = await fetch("http://localhost:3000/api/ai-move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      duelId: startData.duelId,
      playerCard: startData.hand[0],
      aiHintType: "attack",
      history: { streak: 0, totalWins: 0 },
      recentDuels: []
    })
  });

  const moveData = await moveRes.json();
  console.log("AI move response status:", moveRes.status);
  
  if (!moveRes.ok) {
    console.error("Move failed:", moveData);
  } else {
    console.log("Move successful! AI played:", moveData.card.id);
  }
}

testGameFlow();
