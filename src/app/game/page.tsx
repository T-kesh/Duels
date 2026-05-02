"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";

// UI Components
import { GlowButton } from "@/components/ui/GlowButton";
import { HpBar } from "@/components/ui/HpBar";
import { CardTile } from "@/components/ui/CardTile";
import { BattleArena } from "@/components/ui/BattleArena";

// Hooks
import { useGameState } from "@/hooks/useGameState";
import { useClaimReward } from "@/hooks/useClaimReward";
import { useEnergy } from "@/hooks/useEnergy";

export default function GamePage() {
  const { isConnected } = useAccount();
  const router = useRouter();
  
  const {
    hand,
    gameState,
    phase,
    setPhase,
    selectedCard,
    aiCard,
    aiReasoning,
    isLoading,
    usedCardIds,
    aiHintType,
    playTurn
  } = useGameState();

  const { claimStatus, claimReward } = useClaimReward();
  const { lives, useLife, nextRechargeAt, MAX_LIVES } = useEnergy();

  useEffect(() => {
    if (!isConnected) {
      router.push("/");
    }
  }, [isConnected, router]);

  // Handle victory navigation
  useEffect(() => {
    if (phase === "done") {
      const claimState = gameState.playerWon ? "pending" : "none";
      const timer = setTimeout(() => {
        router.push(
          `/result?won=${gameState.playerWon}&playerHp=${gameState.playerHp}&aiHp=${gameState.aiHp}&claim=${claimState}`
        );
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [phase, gameState, router]);

  const onCardSelect = (card: any) => {
    playTurn(card, claimReward);
  };

  return (
    <main className="min-h-screen bg-duel-bg flex flex-col p-6 max-w-md mx-auto animate-fade-in font-sans">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div className="flex flex-col">
          <span className="text-xl font-bold tracking-[0.3em] text-duel-gold">DUEL</span>
          <span className="text-[9px] text-muted-foreground tracking-widest uppercase mt-1">Celo Alfajores</span>
        </div>
        <div className="flex gap-2">
          <div className="px-3 py-1.5 glass border-white/10 rounded-lg flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-bold">⚡</span>
            <span className="text-[10px] font-mono font-bold text-white">
              {lives}/{MAX_LIVES}
            </span>
          </div>
          <div className="px-3 py-1.5 glass border-duel-gold/20 rounded-lg">
            <span className="text-[10px] font-mono font-bold text-duel-gold tracking-widest">
              TURN {Math.min(gameState.turn, 3)}/3
            </span>
          </div>
        </div>
      </header>

      {/* HP Bars */}
      <section className="flex gap-4 mb-10">
        <HpBar hp={gameState.playerHp} label="YOU" />
        <div className="w-[1px] bg-white/5 self-stretch" />
        <HpBar hp={gameState.aiHp} label="CIPHER" />
      </section>

      {/* Battle Status Info */}
      <div className="h-6 mb-2 text-center">
        {claimStatus === "claiming" && (
          <span className="text-[10px] text-duel-gold tracking-[0.2em] animate-pulse uppercase">
            ⏳ Processing Reward...
          </span>
        )}
        {claimStatus === "claimed" && (
          <span className="text-[10px] text-celo-green tracking-[0.2em] uppercase">
            ✓ Reward Claimed
          </span>
        )}
      </div>

      {/* Battle Arena */}
      <BattleArena className={isLoading ? "animate-pulse" : ""}>
        {phase === "draw" && (
          <div className="text-center animate-slide-up">
            <h2 className="text-duel-gold text-sm font-bold tracking-[0.3em] mb-4 uppercase">Hand Dealt</h2>
            <p className="text-muted-foreground text-xs leading-relaxed mb-8">
              3 cards. 3 turns. 1 victor.<br />
              Defeat CIPHER to claim your reward.
            </p>
            <GlowButton 
              onClick={() => {
                if (useLife()) {
                  setPhase("pick");
                }
              }}
              disabled={lives <= 0}
            >
              {lives > 0 ? "Begin Duel" : "Out of Energy"}
            </GlowButton>
            {lives <= 0 && nextRechargeAt && (
              <p className="text-[9px] text-duel-gold/50 mt-4 font-mono uppercase tracking-widest">
                Recharge in: {new Date(nextRechargeAt - Date.now()).toISOString().substr(11, 8)}
              </p>
            )}
          </div>
        )}

        {(phase === "pick" || phase === "resolve" || phase === "done") && (
          <div className="w-full h-full flex flex-col justify-center gap-6">
            {/* Previous Turn History (Simplified) */}
            {gameState.turns.length > 0 && phase === "pick" && (
              <div className="absolute top-4 left-0 right-0 px-4 flex justify-center gap-2 opacity-40">
                {gameState.turns.map((t, i) => (
                  <div key={i} className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded border border-white/10">
                    T{i + 1}: {t.playerCard.emoji} vs {t.aiCard.emoji}
                  </div>
                ))}
              </div>
            )}

            {/* Current Clash */}
            {(phase === "resolve" || phase === "done") && selectedCard && (
              <div className="flex flex-col items-center gap-6 animate-slide-up">
                <div className="flex justify-around w-full items-center gap-4">
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] text-muted-foreground tracking-widest mb-2 uppercase">YOU</span>
                    <div className="text-5xl mb-2">{selectedCard.emoji}</div>
                    <span className="text-[10px] font-bold text-white uppercase">{selectedCard.name}</span>
                  </div>
                  
                  <div className="text-muted-foreground font-bold italic text-sm tracking-widest">VS</div>
                  
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] text-muted-foreground tracking-widest mb-2 uppercase">CIPHER</span>
                    {aiCard ? (
                      <>
                        <div className="text-5xl mb-2 animate-shake">{aiCard.emoji}</div>
                        <span className="text-[10px] font-bold text-duel-gold uppercase">{aiCard.name}</span>
                      </>
                    ) : (
                      <div className="text-4xl text-white/10 animate-pulse">?</div>
                    )}
                  </div>
                </div>

                {aiReasoning && (
                  <div className="mt-4 px-6 py-3 glass-hover bg-white/5 rounded-xl border-duel-gold/10">
                    <p className="text-[11px] text-muted-foreground italic text-center leading-relaxed">
                      " {aiReasoning} "
                    </p>
                  </div>
                )}
              </div>
            )}

            {phase === "pick" && (
              <div className="flex flex-col items-center gap-6 animate-fade-in">
                <div className="relative group">
                  <div className="w-24 h-32 glass border-white/10 rounded-xl flex items-center justify-center relative overflow-hidden shadow-2xl">
                    <div className="absolute inset-0 bg-duel-gold/5 animate-pulse" />
                    <div className="text-3xl opacity-20 grayscale">?</div>
                    
                    {/* Hint Overlay */}
                    <div className="absolute inset-x-0 bottom-0 py-2 bg-duel-gold/10 border-t border-white/5 flex flex-col items-center">
                      <span className="text-[8px] text-duel-gold/60 tracking-widest uppercase mb-1">Hint</span>
                      {aiHintType === "attack" && <span className="text-sm">⚔️</span>}
                      {aiHintType === "defend" && <span className="text-sm">🛡️</span>}
                      {aiHintType === "special" && <span className="text-sm">⚡</span>}
                    </div>
                  </div>
                  
                  {/* Outer Glow */}
                  <div className="absolute -inset-4 bg-duel-gold/5 rounded-full blur-2xl opacity-50 pointer-events-none" />
                </div>
                
                <div className="text-center">
                  <p className="text-[10px] text-duel-gold tracking-[0.3em] uppercase mb-1">CIPHER is ready</p>
                  <p className="text-[9px] text-muted-foreground tracking-[0.1em] italic">
                    It looks like it's preparing a <span className="text-duel-gold font-bold">{aiHintType}</span> move...
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </BattleArena>

      {/* Card Hand */}
      <footer className="mt-auto pt-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">Your Hand</span>
          {phase === "pick" && (
            <span className="text-[9px] text-duel-gold/50 font-mono">3 / 3 CARDS</span>
          )}
        </div>
        
        <div className="flex gap-3 h-36">
          {hand.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              used={usedCardIds.has(card.id)}
              selected={selectedCard?.id === card.id}
              disabled={phase !== "pick" || isLoading}
              onClick={() => onCardSelect(card)}
            />
          ))}
        </div>
      </footer>
    </main>
  );
}
