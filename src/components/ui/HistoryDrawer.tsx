"use client";

import React, { useState, useEffect } from "react";
import { History, X, ChevronRight, Swords, Trophy, Skull } from "lucide-react";
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
          {history.length === 0 ? (
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
