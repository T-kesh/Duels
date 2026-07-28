import { ApiErrorCode } from "@/types/api";

const ERROR_MESSAGES: Record<string, string> = {
  [ApiErrorCode.NO_ENERGY]: "Out of energy. Wait for automatic recharge or top up with USDm.",
  [ApiErrorCode.RATE_LIMIT_EXCEEDED]: "Rate limit reached. Please wait a few minutes before trying again.",
  [ApiErrorCode.SESSION_EXPIRED]: "Duel session expired (45-minute limit per session). Please start a new duel.",
  [ApiErrorCode.UNKNOWN_OR_EXPIRED_DUEL]: "Duel session not found or expired. Please start a new duel.",
  [ApiErrorCode.PLAYER_ADDRESS_MISMATCH]: "Connected wallet does not match the player registered for this duel.",
  [ApiErrorCode.CHALLENGE_EXPIRED]: "Signature request timed out. Please tap Begin Duel to try again.",
  [ApiErrorCode.BAD_SIGNATURE]: "Wallet signature validation failed. Please try again.",
  [ApiErrorCode.MISSING_PLAYER]: "Missing player address. Connect your wallet.",
  [ApiErrorCode.MISSING_TX_HASH]: "Transaction hash is required for energy top-up.",
  [ApiErrorCode.INVALID_PLAYER_ADDRESS]: "Invalid player wallet address.",
  [ApiErrorCode.TRANSACTION_NOT_FOUND_OR_FAILED]: "Top-up transaction not found on-chain or failed. Please check Celo explorer.",
  [ApiErrorCode.TRANSFER_MISMATCH]: "USDm top-up transfer amount was insufficient or sent to the wrong treasury address.",
  [ApiErrorCode.TX_ALREADY_CONSUMED]: "This top-up transaction has already been credited to a player account.",
  [ApiErrorCode.INTERNAL_TOPUP_FAILURE]: "Server top-up processing failed. Please contact support.",
  [ApiErrorCode.AI_MOVE_FAILED]: "CIPHER AI move failed to resolve. Please try playing your turn again.",
  [ApiErrorCode.ILLEGAL_CARD_FOR_SESSION]: "Selected card is not valid for your current session hand.",
  [ApiErrorCode.CARD_ALREADY_USED]: "This card has already been played in a previous turn.",
  [ApiErrorCode.ROUND_DEADLINE_PASSED]: "Round deadline expired. You can claim a forfeit win if opponent timed out.",
  [ApiErrorCode.DUEL_ALREADY_COMPLETE]: "This duel has already finished.",
  [ApiErrorCode.GAME_NOT_ELIGIBLE_FOR_REWARD]: "Duel state replay was not eligible for a reward signature.",
  [ApiErrorCode.INCOMPLETE_TRANSCRIPT]: "Duel ended before all 3 turns were played.",
  [ApiErrorCode.REWARD_ALREADY_CLAIMED]: "Reward signature has already been issued for this duel session.",
  [ApiErrorCode.RESOLVE_ALREADY_ISSUED]: "PvP settlement signature has already been generated.",
  [ApiErrorCode.MISSING_DUEL_ID]: "Missing duel ID reference.",
  [ApiErrorCode.DUEL_NOT_COMPLETE]: "PvP duel is still in progress.",
  [ApiErrorCode.DUEL_NOT_ACTIVE]: "On-chain duel escrow is no longer active.",
  [ApiErrorCode.DUEL_NOT_JOINED_YET]: "Waiting for an opponent to join this PvP duel escrow.",
  [ApiErrorCode.SERVER_MISCONFIGURED]: "Server key or network misconfiguration. Contact support.",
  [ApiErrorCode.INTERNAL_ERROR]: "Internal server error. Please try again in a moment.",
};

/**
 * Resolves raw API error codes or Error objects into friendly, human-readable UI messages.
 */
export function getFriendlyErrorMessage(err: unknown, defaultFallback = "An unexpected error occurred. Please try again."): string {
  if (!err) return defaultFallback;

  let codeStr = "";

  if (typeof err === "string") {
    codeStr = err.trim();
  } else if (err instanceof Error) {
    codeStr = err.message.trim();
  } else if (typeof err === "object" && err !== null && "error" in err) {
    codeStr = String((err as { error: unknown }).error).trim();
  }

  if (!codeStr) return defaultFallback;

  // Direct match in error map
  if (ERROR_MESSAGES[codeStr]) {
    return ERROR_MESSAGES[codeStr];
  }

  // Case-insensitive / partial pattern matching for common Web3 / RPC errors
  const lower = codeStr.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("denied")) {
    return "Transaction or signature request was rejected in your wallet.";
  }
  if (lower.includes("poolempty") || lower.includes("0xe5ea1016")) {
    return "Contract reward pool is currently empty. Please contact support.";
  }
  if (lower.includes("dailylimitreached") || lower.includes("0xc4506c04")) {
    return "Daily reward claim limit reached (max 5 claims per day).";
  }
  if (lower.includes("insufficient funds") || lower.includes("exceeds balance")) {
    return "Insufficient USDm balance in your wallet.";
  }

  return codeStr.length > 120 ? `${codeStr.slice(0, 117)}…` : codeStr;
}
