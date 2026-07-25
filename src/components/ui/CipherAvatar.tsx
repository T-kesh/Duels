"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface CipherAvatarProps {
  hp: number;
  maxHp?: number;
  isActing?: boolean;
  className?: string;
}

export function CipherAvatar({
  hp,
  maxHp = 100,
  isActing = false,
  className,
}: CipherAvatarProps) {
  const percentage = Math.max(0, Math.min(100, (hp / maxHp) * 100));

  // Determine state color scheme
  let eyeColor = "#fcc419"; // gold default
  let glowColor = "rgba(252, 196, 25, 0.4)";
  let statusLabel = "CIPHER v2.4";

  if (percentage <= 30) {
    eyeColor = "#ef4444"; // critical red
    glowColor = "rgba(239, 68, 68, 0.6)";
    statusLabel = "CRITICAL";
  } else if (percentage <= 60) {
    eyeColor = "#f59e0b"; // wounded amber
    glowColor = "rgba(245, 158, 11, 0.5)";
    statusLabel = "ALERT";
  }

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative group flex items-center justify-center">
        {/* Outer aura glow */}
        <div
          className={cn(
            "w-12 h-12 rounded-full absolute transition-all duration-500 blur-md pointer-events-none opacity-60",
            isActing && "scale-125 opacity-100 animate-pulse",
          )}
          style={{ backgroundColor: glowColor }}
        />

        {/* Avatar SVG Container */}
        <div
          className={cn(
            "w-10 h-10 rounded-full glass border border-white/10 flex items-center justify-center relative overflow-hidden bg-neutral-950/80 transition-all duration-300",
            isActing && "animate-eye-flare border-duel-gold/50",
            percentage <= 30 && "animate-pulse border-destructive/50",
          )}
        >
          {/* Cyberpunk grid background overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:6px_6px] opacity-40" />

          {/* SVG Glowing Eye Motif */}
          <svg
            className={cn(
              "w-6 h-6 z-10 transition-transform duration-300",
              isActing ? "scale-110" : "animate-eye-blink",
            )}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outer Diamond Iris Frame */}
            <path
              d="M12 2L20 12L12 22L4 12L12 2Z"
              stroke={eyeColor}
              strokeWidth="1.5"
              strokeLinejoin="round"
              className="opacity-70"
            />
            {/* Hexagon Core */}
            <polygon
              points="12,6 17,9.5 17,14.5 12,18 7,14.5 7,9.5"
              fill={eyeColor}
              fillOpacity="0.2"
              stroke={eyeColor}
              strokeWidth="1"
            />
            {/* Center Pupil Flare */}
            <circle
              cx="12"
              cy="12"
              r="2.5"
              fill={eyeColor}
              className={cn(
                "transition-all duration-300",
                isActing && "r-3.5 fill-white",
              )}
            />
            {/* Scanning Ring */}
            <circle
              cx="12"
              cy="12"
              r="7"
              stroke={eyeColor}
              strokeWidth="0.75"
              strokeDasharray="2 2"
              className="animate-spin [animation-duration:8s]"
            />
          </svg>
        </div>
      </div>

      <span
        className={cn(
          "text-[7px] font-mono tracking-[0.2em] uppercase font-bold transition-colors duration-300",
          percentage <= 30
            ? "text-destructive"
            : percentage <= 60
              ? "text-amber-400"
              : "text-duel-gold/70",
        )}
      >
        {statusLabel}
      </span>
    </div>
  );
}
