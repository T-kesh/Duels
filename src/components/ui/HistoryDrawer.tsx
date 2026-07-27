"use client";

import React, { useState, useEffect } from "react";
import { History, X, ChevronRight, Swords, Trophy, Skull, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { readRecentDuels, RecentDuelResult } from "@/lib/recentDuels";
import { STARTING_HP, CARDS } from "@/constants/cards";

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HistoryDrawer({ isOpen, onClose }: HistoryDrawerProps) {
  const [history, setHistory] = useState<RecentDuelResult[]>([]);
  const [selectedDuel, setSelectedDuel] = useState<RecentDuelResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      setHistory(readRecentDuels(20)); // Load up to 20 past duels
      setSelectedDuel(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" 
        onClick={onClose} 
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-md h-full bg-neutral-950 border-l border-white/10 shadow-2xl flex flex-col animate-slide-left">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-duel-gold" />
            <h2 className="font-bold text-white tracking-widest uppercase text-sm">Battle Log</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-muted-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {selectedDuel ? (
            <div className="space-y-4 animate-fade-in">
              <button 
                onClick={() => setSelectedDuel(null)}
                className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-white uppercase tracking-widest transition-colors mb-4"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back to Log
              </button>
              
              <div className="glass p-4 rounded-xl text-center space-y-1 mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  {selectedDuel.won ? (
                    <Trophy className="w-6 h-6 text-duel-gold" />
                  ) : (
                    <Skull className="w-6 h-6 text-red-500" />
                  )}
                  <h3 className={cn("text-lg font-black uppercase tracking-widest", selectedDuel.won ? "text-duel-gold" : "text-red-500")}>
                    {selectedDuel.won ? "Victory" : "Defeat"}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Final HP: <span className="text-white font-bold">{selectedDuel.playerHp}</span> / {STARTING_HP}
                </p>
                {selectedDuel.rewardTier && (
                  <p className="text-[10px] text-duel-gold font-bold uppercase tracking-widest mt-2">
                    Reward Tier: {selectedDuel.rewardTier}
                  </p>
                )}
              </div>

              <div className="space-y-3 relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-2 bottom-2 w-px bg-white/10" />

                {selectedDuel.turns?.map((turn, idx) => {
                  const pCard = CARDS.find(c => c.id === turn.playerCard);
                  const aCard = CARDS.find(c => c.id === turn.aiCard);
                  
                  return (
                    <div key={idx} className="relative pl-10">
                      <div className="absolute left-2.5 top-3 w-3 h-3 rounded-full bg-neutral-900 border-2 border-white/20" />
                      
                      <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col gap-3 hover:bg-white/10 transition-colors">
                        <div className="text-[9px] font-black text-muted-foreground tracking-widest uppercase flex items-center justify-between">
                          <span>Turn {idx + 1}</span>
                          {turn.playerCombo && <Flame className="w-3 h-3 text-duel-gold" />}
                        </div>
                        
                        <div className="flex justify-between items-center gap-2">
                          {/* Player Side */}
                          <div className="flex flex-col flex-1 items-start gap-1">
                            <span className="text-[8px] text-white/40 uppercase tracking-widest">You</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{pCard?.emoji || "?"}</span>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-white">{pCard?.name || turn.playerCard}</span>
                                {turn.playerCombo && (
                                  <span className="text-[8px] font-bold text-duel-gold uppercase">{turn.playerCombo} Combo</span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs font-mono text-sky-400 mt-1">Dmg: {turn.playerDmg}</span>
                          </div>

                          <Swords className="w-4 h-4 text-white/20 shrink-0" />

                          {/* AI Side */}
                          <div className="flex flex-col flex-1 items-end gap-1 text-right">
                            <span className="text-[8px] text-white/40 uppercase tracking-widest">Cipher</span>
                            <div className="flex items-center gap-2 flex-row-reverse">
                              <span className="text-xl">{aCard?.emoji || "?"}</span>
                              <div className="flex flex-col items-end">
                                <span className="text-xs font-bold text-white">{aCard?.name || turn.aiCard}</span>
                                {turn.aiCombo && (
                                  <span className="text-[8px] font-bold text-destructive uppercase">{turn.aiCombo} Combo</span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs font-mono text-red-400 mt-1">Dmg: {turn.aiDmg}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
              <History className="w-12 h-12 mb-3" />
              <p className="text-sm font-bold tracking-widest uppercase">No battles fought</p>
              <p className="text-xs">Your recent duels will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((duel, i) => (
                <div 
                  key={duel.duelId || i}
                  className="bg-white/5 border border-white/5 rounded-xl p-3 hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => setSelectedDuel(duel)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {duel.won ? (
                        <Trophy className="w-4 h-4 text-duel-gold" />
                      ) : (
                        <Skull className="w-4 h-4 text-red-500" />
                      )}
                      <span className={cn(
                        "text-xs font-black tracking-widest uppercase",
                        duel.won ? "text-duel-gold" : "text-red-500"
                      )}>
                        {duel.won ? "Victory" : "Defeat"}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(duel.at).toLocaleString(undefined, {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
                      })}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <div>HP: {duel.playerHp} / {STARTING_HP}</div>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
