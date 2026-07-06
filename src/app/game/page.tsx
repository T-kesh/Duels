"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";

import { GlowButton } from "@/components/ui/GlowButton";
import { BattleArena } from "@/components/ui/BattleArena";
import { GameHeader } from "@/components/game/GameHeader";
import { HealthBarsSection } from "@/components/game/HealthBarsSection";
import { PlayerHand } from "@/components/game/PlayerHand";
import { TurnHistory } from "@/components/game/TurnHistory";

import { useGameState } from "@/hooks/useGameState";
import { useEnergy } from "@/hooks/useEnergy";
import { useEnergyTopUp } from "@/hooks/useEnergyTopUp";

export default function GamePage() {
  const { isConnected } = useAccount();
  const router = useRouter();

  const {
    duelId,
    hand,
    startupError,
    dealingDeck,
    gameState,
    phase,
    setPhase,
    selectedCard,
    aiCard,
    aiReasoning,
    isLoading,
    usedCardIds,
    aiHintType,
    turnError,
    lastDamageFlash,
    perfectDuelToast,
    beginDuel,
    playTurn,
  } = useGameState();

  const { lives, bonusLives, totalPlaysRemaining, nextRechargeAt, MAX_LIVES } = useEnergy();
  const topUp = useEnergyTopUp();

  useEffect(() => {
    if (!isConnected) {
      router.push("/");
    }
  }, [isConnected, router]);

  // Keep refs to the latest gameState/duelId so the delayed redirect always
  // reads the final settled values, not a stale closure from the render that
  // first set phase to "done".
  const latestGameState = useRef(gameState);
  latestGameState.current = gameState;
  const latestDuelId = useRef(duelId);
  latestDuelId.current = duelId;

  useEffect(() => {
    if (phase === "done") {
      const timer = setTimeout(() => {
        const gs = latestGameState.current;
        // The reward claim itself is handled entirely on /result, where the
        // player will actually be present to approve a wallet prompt — firing
        // it here would orphan that request the moment this page unmounts.
        const params = new URLSearchParams({
          won: String(gs.playerWon),
          playerHp: String(gs.playerHp),
          aiHp: String(gs.aiHp),
        });
        if (gs.playerWon && latestDuelId.current) {
          params.set("duelId", latestDuelId.current);
        }
        router.push(`/result?${params.toString()}`);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [phase, router]);

  const onCardSelect = (card: Parameters<typeof playTurn>[0]) => {
    playTurn(card);
  };

  const clutchTurn = phase === "pick" && gameState.turn === 3;

  return (
    <main className="min-h-screen bg-duel-bg flex flex-col p-6 max-w-md mx-auto animate-fade-in font-sans">
      <GameHeader
        rechargeableLives={lives}
        bonusLives={bonusLives}
        maxBaseLives={MAX_LIVES}
        currentTurnDisplay={Math.min(gameState.turn, 3)}
      />

      <HealthBarsSection
        playerHp={gameState.playerHp}
        aiHp={gameState.aiHp}
        damageFlash={lastDamageFlash}
        clutchTurn={clutchTurn}
      />

      {perfectDuelToast && (
        <div className="mb-4 text-center glass border-celo-green/30 px-4 py-2 rounded-xl text-[11px] text-celo-green animate-fade-in">
          Perfect duel! +1 bonus energy secured.
        </div>
      )}

      {startupError && (
        <div className="mb-4 text-center glass border-destructive/30 px-4 py-2 rounded-xl text-[11px] text-destructive">
          {startupError}
        </div>
      )}

      {turnError && (
        <div className="mb-4 text-center glass border-duel-gold/30 px-4 py-2 rounded-xl text-[11px] text-duel-gold animate-fade-in">
          ⚠️ {turnError}
        </div>
      )}

      <BattleArena className={isLoading ? "animate-pulse" : ""}>
        {phase === "draw" && (
          <div className="text-center animate-slide-up">
            <h2 className="text-duel-gold text-sm font-bold tracking-[0.3em] mb-4 uppercase">Enter the Arena</h2>
            <p className="text-muted-foreground text-xs leading-relaxed mb-6">
              3 cards. 3 turns. 1 victor.
              <br />
              Defeat CIPHER to claim your reward.
            </p>

            {dealingDeck && (
              <p className="text-[11px] text-duel-gold/70 animate-pulse tracking-[0.2em] uppercase mb-4">
                Securing duel session…
              </p>
            )}

            <GlowButton
              onClick={async () => {
                const ok = await beginDuel();
                if (ok) setPhase("pick");
              }}
              disabled={dealingDeck || totalPlaysRemaining <= 0}
            >
              {totalPlaysRemaining > 0 ? "Begin Duel" : "Out of Energy"}
            </GlowButton>

            {totalPlaysRemaining <= 0 && nextRechargeAt && (
              <p className="text-[9px] text-duel-gold/50 mt-4 font-mono uppercase tracking-widest">
                Recharge in: {new Date(nextRechargeAt - Date.now()).toISOString().substr(11, 8)}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-2 items-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-[0.3em]">Need more fights?</p>
              <GlowButton
                variant="outline"
                size="sm"
                disabled={!topUp.enabled || topUp.status === "pending" || topUp.status === "verifying"}
                onClick={() => topUp.buyEnergy()}
              >
                {topUp.status === "pending" || topUp.status === "verifying"
                  ? "Confirming..."
                  : `Top up (+1) · ${topUp.priceLabel}`}
              </GlowButton>
              {!topUp.enabled && (
                <p className="text-[8px] text-muted-foreground/70 px-6">
                  Configure treasury + token env keys to unlock paid refills (see .env.example).
                </p>
              )}
            </div>
          </div>
        )}

        {(phase === "pick" || phase === "resolve" || phase === "done") && (
          <div className="relative w-full h-full flex flex-col justify-center gap-6">
            <TurnHistory turns={gameState.turns} visible={phase === "pick"} />

            {(phase === "resolve" || phase === "done") && selectedCard && (
              <div className="flex flex-col items-center gap-6 animate-slide-up">
                <div className="flex justify-around w-full items-center gap-4">
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] text-muted-foreground tracking-widest mb-2 uppercase">
                      YOU
                    </span>
                    <div className="text-5xl mb-2">{selectedCard.emoji}</div>
                    <span className="text-[10px] font-bold text-white uppercase">{selectedCard.name}</span>
                  </div>

                  <div className="text-muted-foreground font-bold italic text-sm tracking-widest">VS</div>

                  <div className="flex flex-col items-center">
                    <span className="text-[8px] text-muted-foreground tracking-widest mb-2 uppercase">
                      CIPHER
                    </span>
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
                      &ldquo;{aiReasoning}&rdquo;
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

                    <div className="absolute inset-x-0 bottom-0 py-2 bg-duel-gold/10 border-t border-white/5 flex flex-col items-center">
                      <span className="text-[8px] text-duel-gold/60 tracking-widest uppercase mb-1">Hint</span>
                      {aiHintType === "attack" && <span className="text-sm">⚔️</span>}
                      {aiHintType === "defend" && <span className="text-sm">🛡️</span>}
                      {aiHintType === "special" && <span className="text-sm">⚡</span>}
                    </div>
                  </div>

                  <div className="absolute -inset-4 bg-duel-gold/5 rounded-full blur-2xl opacity-50 pointer-events-none" />
                </div>

                <div className="text-center">
                  <p className="text-[10px] text-duel-gold tracking-[0.3em] uppercase mb-1">CIPHER is ready</p>
                  <p className="text-[9px] text-muted-foreground tracking-[0.1em] italic">
                    Honoring the hint grants CIPHER +5 shield.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </BattleArena>

      <PlayerHand
        hand={hand}
        usedCardIds={usedCardIds}
        selectedCard={selectedCard}
        disabled={phase !== "pick" || isLoading || dealingDeck || !duelId}
        showCount={phase === "pick"}
        aiHintType={phase === "pick" ? aiHintType : null}
        onSelect={onCardSelect}
      />
    </main>
  );
}
