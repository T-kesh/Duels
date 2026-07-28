import { describe, it, expect } from "vitest";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { ApiErrorCode } from "@/types/api";

describe("getFriendlyErrorMessage", () => {
  it("resolves known ApiErrorCode enum values to human-readable strings", () => {
    expect(getFriendlyErrorMessage(ApiErrorCode.NO_ENERGY)).toBe(
      "Out of energy. Wait for automatic recharge or top up with USDm.",
    );
    expect(getFriendlyErrorMessage(ApiErrorCode.SESSION_EXPIRED)).toBe(
      "Duel session expired (45-minute limit per session). Please start a new duel.",
    );
    expect(getFriendlyErrorMessage(ApiErrorCode.RATE_LIMIT_EXCEEDED)).toBe(
      "Rate limit reached. Please wait a few minutes before trying again.",
    );
  });

  it("handles string error codes directly", () => {
    expect(getFriendlyErrorMessage("player_address_mismatch")).toBe(
      "Connected wallet does not match the player registered for this duel.",
    );
  });

  it("handles Error objects containing error codes or messages", () => {
    const err = new Error("tx_already_consumed");
    expect(getFriendlyErrorMessage(err)).toBe(
      "This top-up transaction has already been credited to a player account.",
    );
  });

  it("handles JSON objects containing an error property", () => {
    const obj = { error: "bad_signature" };
    expect(getFriendlyErrorMessage(obj)).toBe(
      "Wallet signature validation failed. Please try again.",
    );
  });

  it("resolves Web3 wallet rejection patterns", () => {
    expect(getFriendlyErrorMessage(new Error("User rejected the request."))).toBe(
      "Transaction or signature request was rejected in your wallet.",
    );
  });

  it("resolves contract revert custom errors (PoolEmpty, DailyLimitReached)", () => {
    expect(getFriendlyErrorMessage(new Error("execution reverted: 0xe5ea1016"))).toBe(
      "Contract reward pool is currently empty. Please contact support.",
    );
    expect(getFriendlyErrorMessage(new Error("execution reverted: DailyLimitReached()"))).toBe(
      "Daily reward claim limit reached (max 5 claims per day).",
    );
  });

  it("returns fallback for empty or unknown inputs", () => {
    expect(getFriendlyErrorMessage(null)).toBe("An unexpected error occurred. Please try again.");
    expect(getFriendlyErrorMessage(undefined, "Custom fallback")).toBe("Custom fallback");
  });
});
