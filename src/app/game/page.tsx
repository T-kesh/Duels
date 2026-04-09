"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWalletClient } from "wagmi";
import { drawHand, Card } from "@/constants/cards";
import { initGameState, resolveTurn, GameState } from "@/lib/gameEngine";

type Phase = "draw" | "pick" | "resolve" | "done";

const CONTRACT_ADDRESS = "0xA259c4D6Fa76dB7aC26BFd10832AAE202cce4519";

export default function GamePage() {
  const { isConnected, address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const router = useRouter();

  useEffect(() => {
    if (!isConnected) {
      router.push("/");
    }
  }, [isConnected, router]);

  const [hand] = useState<Card[]>(drawHand);
  const [gameState, setGameState] = useState<GameState>(initGameState);
  const [phase, setPhase] = useState<Phase>("draw");
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [aiCard, setAiCard] = useState<Card | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [usedCardIds, setUsedCardIds] = useState<Set<string>>(new Set());
  const [claimStatus, setClaimStatus] = useState<"idle" | "claiming" | "claimed" | "failed">("idle");

  const claimReward = useCallback(async () => {
    if (!address || !walletClient) return;
    setClaimStatus("claiming");

    try {
      // Ask your backend to sign a reward for this player
      const res = await fetch("/api/claim-reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerAddress: address }),
      });

      if (!res.ok) throw new Error("Failed to get reward signature");

      const { nonce, signature } = await res.json();

      // Call claimReward on the contract
      const { writeContract } = await import("wagmi/actions");
      const { getConfig } = await import("@/lib/wagmi"); // adjust to your wagmi config path

      await writeContract(getConfig(), {
        address: CONTRACT_ADDRESS,
        abi: [
          {
            name: "claimReward",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "nonce", type: "bytes32" },
              { name: "signature", type: "bytes" },
            ],
            outputs: [],
          },
        ],
        functionName: "claimReward",
        args: [nonce, signature],
      });

      setClaimStatus("claimed");
    } catch (err) {
      console.error("Claim failed:", err);
      setClaimStatus("failed");
    }
  }, [address, walletClient]);

  const playTurn = useCallback(async (playerCard: Card) => {
    if (isLoading || usedCardIds.has(playerCard.id)) return;
    setIsLoading(true);
    setSelectedCard(playerCard);
    setPhase("resolve");

    try {
      const res = await fetch("/api/ai-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerCard,
          aiHp: gameState.aiHp,
          playerHp: gameState.playerHp,
          turn: gameState.turn,
        }),
      });

      const data = await res.json();
      const cipher: Card = data.card;
      const reasoning: string = data.reasoning;

      setAiCard(cipher);
      setAiReasoning(reasoning);

      await new Promise((r) => setTimeout(r, 1200));

      const newState = resolveTurn(gameState, playerCard, cipher);
      setGameState(newState);
      setUsedCardIds((prev) => new Set([...prev, playerCard.id]));

      if (newState.isOver) {
        // Update win streak
        if (newState.playerWon) {
          const streak = parseInt(localStorage.getItem('duel_streak') || '0') + 1;
          localStorage.setItem('duel_streak', streak.toString());
          const best = parseInt(localStorage.getItem('duel_best_streak') || '0');
          if (streak > best) localStorage.setItem('duel_best_streak', streak.toString());
          // Update total wins
          const totalWins = parseInt(localStorage.getItem('duel_total_wins') || '0') + 1;
          localStorage.setItem('duel_total_wins', totalWins.toString());

          // Trigger reward claim in background — don't block navigation
          claimReward();
        } else {
          localStorage.setItem('duel_streak', '0');
        }

        setTimeout(() => {
          router.push(`/result?won=${newState.playerWon}&playerHp=${newState.playerHp}&aiHp=${newState.aiHp}`);
        }, 1800);
      } else {
        setTimeout(() => {
          setAiCard(null);
          setSelectedCard(null);
          setAiReasoning("");
          setPhase("pick");
        }, 1800);
      }
    } catch {
      setIsLoading(false);
      setPhase("pick");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, usedCardIds, gameState, router, claimReward]);

  const hpColor = (hp: number) =>
    hp > 60 ? "#35d46a" : hp > 30 ? "#fcc419" : "#ff4d4f";

  const HpBar = ({ hp, label }: { hp: number; label: string }) => (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "10px", color: "#666", letterSpacing: "2px" }}>{label}</span>
        <span style={{ fontSize: "12px", color: hpColor(hp), fontWeight: "700" }}>{hp}</span>
      </div>
      <div style={{ height: "6px", background: "#1a1a2e", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${hp}%`, background: hpColor(hp), borderRadius: "3px", transition: "width 0.6s ease", boxShadow: `0 0 8px ${hpColor(hp)}60` }} />
      </div>
    </div>
  );

  const CardTile = ({ card, onClick, used, selected }: { card: Card; onClick: () => void; used: boolean; selected: boolean }) => (
    <button
      onClick={onClick}
      disabled={used || isLoading || phase !== "pick"}
      style={{
        flex: 1, padding: "14px 8px",
        background: selected ? "rgba(252,196,25,0.15)" : used ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${selected ? "#fcc419" : used ? "#222" : "rgba(252,196,25,0.2)"}`,
        borderRadius: "10px",
        cursor: used || isLoading || phase !== "pick" ? "not-allowed" : "pointer",
        opacity: used ? 0.35 : 1,
        transition: "all 0.2s ease",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
        fontFamily: "'Courier New', monospace",
      }}
    >
      <span style={{ fontSize: "28px" }}>{card.emoji}</span>
      <span style={{ fontSize: "11px", color: used ? "#444" : "#fff", fontWeight: "700", letterSpacing: "1px" }}>
        {card.name.toUpperCase()}
      </span>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
        {card.damage > 0 && (
          <span style={{ fontSize: "9px", color: "#ff6b6b", background: "rgba(255,107,107,0.1)", padding: "2px 5px", borderRadius: "4px" }}>
            -{card.damage}HP
          </span>
        )}
        {card.shield > 0 && (
          <span style={{ fontSize: "9px", color: "#74c0fc", background: "rgba(116,192,252,0.1)", padding: "2px 5px", borderRadius: "4px" }}>
            +{card.shield}DEF
          </span>
        )}
        <span style={{ fontSize: "9px", color: "#555", textAlign: "center", marginTop: "2px", lineHeight: "1.3" }}>
          {card.description}
        </span>
      </div>
    </button>
  );

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", flexDirection: "column", padding: "20px 16px", fontFamily: "'Courier New', monospace", maxWidth: "420px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <span style={{ fontSize: "18px", fontWeight: "900", color: "#fcc419", letterSpacing: "4px" }}>DUEL</span>
        <span style={{ fontSize: "10px", color: "#444", letterSpacing: "2px" }}>TURN {Math.min(gameState.turn, 3)}/3</span>
      </div>

      {/* HP Bars */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "28px" }}>
        <HpBar hp={gameState.playerHp} label="YOU" />
        <div style={{ width: "1px", background: "#222" }} />
        <HpBar hp={gameState.aiHp} label="CIPHER" />
      </div>

      {/* Claim status indicator — only shows when a claim is in progress */}
      {claimStatus === "claiming" && (
        <div style={{ textAlign: "center", marginBottom: "12px", fontSize: "10px", color: "#fcc419", letterSpacing: "2px" }}>
          ⏳ CLAIMING REWARD...
        </div>
      )}
      {claimStatus === "claimed" && (
        <div style={{ textAlign: "center", marginBottom: "12px", fontSize: "10px", color: "#35d46a", letterSpacing: "2px" }}>
          ✓ REWARD CLAIMED
        </div>
      )}
      {claimStatus === "failed" && (
        <div style={{ textAlign: "center", marginBottom: "12px", fontSize: "10px", color: "#ff4d4f", letterSpacing: "2px" }}>
          ✗ CLAIM FAILED — TRY LATER
        </div>
      )}

      {/* Battle Zone */}
      <div style={{ flex: 1, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(252,196,25,0.1)", borderRadius: "14px", padding: "20px", marginBottom: "24px", minHeight: "200px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
        {phase === "draw" && (
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#fcc419", fontSize: "12px", letterSpacing: "3px", marginBottom: "20px" }}>HAND DEALT</p>
            <p style={{ color: "#666", fontSize: "13px", marginBottom: "24px" }}>You have 3 cards. Use each once.<br />Choose wisely against CIPHER.</p>
            <button
              onClick={() => setPhase("pick")}
              style={{ padding: "12px 32px", background: "#fcc419", color: "#0a0a0f", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "900", letterSpacing: "3px", cursor: "pointer", fontFamily: "'Courier New', monospace" }}
            >
              BEGIN
            </button>
          </div>
        )}

        {(phase === "pick" || phase === "resolve") && (
          <>
            {gameState.turns.length > 0 && (
              <div style={{ width: "100%", maxHeight: "120px", overflowY: "auto" }}>
                {gameState.turns.map((t, i) => (
                  <div key={i} style={{ fontSize: "11px", color: "#555", padding: "6px 0", borderBottom: "1px solid #111", display: "flex", justifyContent: "space-between" }}>
                    <span>T{i + 1}: {t.playerCard.emoji} vs {t.aiCard.emoji}</span>
                    <span>
                      <span style={{ color: "#ff6b6b" }}>-{t.aiDamageDealt}</span>
                      {" / "}
                      <span style={{ color: "#35d46a" }}>-{t.playerDamageDealt}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {phase === "resolve" && selectedCard && (
              <div style={{ width: "100%", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", marginBottom: "12px" }}>
                  <div>
                    <p style={{ fontSize: "9px", color: "#666", letterSpacing: "2px", marginBottom: "6px" }}>YOU</p>
                    <span style={{ fontSize: "36px" }}>{selectedCard.emoji}</span>
                    <p style={{ fontSize: "11px", color: "#fff", marginTop: "4px" }}>{selectedCard.name}</p>
                  </div>
                  <span style={{ fontSize: "20px", color: "#333" }}>VS</span>
                  <div>
                    <p style={{ fontSize: "9px", color: "#666", letterSpacing: "2px", marginBottom: "6px" }}>CIPHER</p>
                    {aiCard ? (
                      <>
                        <span style={{ fontSize: "36px" }}>{aiCard.emoji}</span>
                        <p style={{ fontSize: "11px", color: "#fcc419", marginTop: "4px" }}>{aiCard.name}</p>
                      </>
                    ) : (
                      <span style={{ fontSize: "24px", color: "#333" }}>...</span>
                    )}
                  </div>
                </div>
                {aiReasoning && (
                  <p style={{ fontSize: "10px", color: "#444", fontStyle: "italic" }}>CIPHER: "{aiReasoning}"</p>
                )}
              </div>
            )}

            {phase === "pick" && gameState.turns.length === 0 && (
              <p style={{ color: "#444", fontSize: "12px", letterSpacing: "2px" }}>SELECT A CARD BELOW</p>
            )}
          </>
        )}

        {isLoading && phase === "resolve" && !aiCard && (
          <p style={{ color: "#fcc419", fontSize: "11px", letterSpacing: "3px" }}>CIPHER THINKING...</p>
        )}
      </div>

      {/* Card Hand */}
      <div>
        <p style={{ fontSize: "9px", color: "#333", letterSpacing: "3px", marginBottom: "10px" }}>YOUR HAND</p>
        <div style={{ display: "flex", gap: "8px" }}>
          {hand.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              used={usedCardIds.has(card.id)}
              selected={selectedCard?.id === card.id}
              onClick={() => playTurn(card)}
            />
          ))}
        </div>
      </div>
    </main>
  );
}