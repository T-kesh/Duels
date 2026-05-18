"use client";

interface ClaimStatusStripProps {
  status: "idle" | "claiming" | "claimed" | "failed";
}

export function ClaimStatusStrip({ status }: ClaimStatusStripProps) {
  return (
    <div className="h-6 mb-2 text-center">
      {status === "claiming" && (
        <span className="text-[10px] text-duel-gold tracking-[0.2em] animate-pulse uppercase">
          ⏳ Processing Reward...
        </span>
      )}
      {status === "claimed" && (
        <span className="text-[10px] text-celo-green tracking-[0.2em] uppercase">
          ✓ Reward Claimed
        </span>
      )}
      {status === "failed" && (
        <span className="text-[10px] text-destructive tracking-[0.2em] uppercase">
          ✕ Claim failed · try again later
        </span>
      )}
    </div>
  );
}
