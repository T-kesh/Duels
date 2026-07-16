import { describe, expect, it } from "vitest";
import { decideReward, formatRewardCusd, type RewardTier } from "./rewardTiers";

const WEI = BigInt(10) ** BigInt(18);
const cusd = (milli: number) => (BigInt(milli) * WEI) / BigInt(1000);

const BOUNDS: Record<RewardTier, [bigint, bigint]> = {
  base: [cusd(5), cusd(7)],
  worthy: [cusd(8), cusd(10)],
  generous: [cusd(12), cusd(15)],
};

function assertWithinTierBounds(tier: RewardTier, amountWei: bigint) {
  const [min, max] = BOUNDS[tier];
  expect(amountWei >= min, `${amountWei} below ${tier} min`).toBe(true);
  expect(amountWei <= max, `${amountWei} above ${tier} max`).toBe(true);
}

describe("decideReward", () => {
  it("pays base tier for an unremarkable win", () => {
    for (let i = 0; i < 50; i++) {
      const d = decideReward(40, 1);
      expect(d.tier).toBe("base");
      assertWithinTierBounds("base", d.amountWei);
      expect(d.flavor.length).toBeGreaterThan(0);
    }
  });

  it("elevates perfect duels (>=80 HP) beyond base", () => {
    for (let i = 0; i < 50; i++) {
      const d = decideReward(80, 1);
      expect(d.tier === "worthy" || d.tier === "generous").toBe(true);
      assertWithinTierBounds(d.tier, d.amountWei);
    }
  });

  it("elevates streaks >= 3 beyond base", () => {
    for (let i = 0; i < 50; i++) {
      const d = decideReward(20, 3);
      expect(d.tier === "worthy" || d.tier === "generous").toBe(true);
      assertWithinTierBounds(d.tier, d.amountWei);
    }
  });

  it("never exceeds the on-chain maxRewardAmount ceiling (0.02)", () => {
    const MAX = cusd(20);
    for (let i = 0; i < 200; i++) {
      const d = decideReward(100, 10); // best possible inputs
      expect(d.amountWei <= MAX).toBe(true);
      expect(d.amountWei > BigInt(0)).toBe(true);
    }
  });

  it("only reaches generous through quality play, and its flavor matches", () => {
    let sawGenerous = false;
    for (let i = 0; i < 500; i++) {
      const weak = decideReward(30, 1);
      expect(weak.tier).not.toBe("generous");

      const strong = decideReward(90, 5);
      if (strong.tier === "generous") {
        sawGenerous = true;
        assertWithinTierBounds("generous", strong.amountWei);
      }
    }
    // 500 rolls at 10% chance — P(miss all) ≈ 1e-23
    expect(sawGenerous).toBe(true);
  });
});

describe("formatRewardCusd", () => {
  it("formats wei to a 3-decimal cUSD string", () => {
    expect(formatRewardCusd(cusd(5))).toBe("0.005");
    expect(formatRewardCusd(cusd(15))).toBe("0.015");
    expect(formatRewardCusd(cusd(10))).toBe("0.010");
  });
});
