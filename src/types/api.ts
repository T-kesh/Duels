import type { Card } from "@/constants/cards";
import type { TurnResult, AiHintType } from "@/lib/gameEngine";

// ── Standard API Error Codes ──────────────────────────────────────────────────

export enum ApiErrorCode {
  INVALID_REQUEST = "invalid_request",
  NO_ENERGY = "no_energy",
  RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",
  SESSION_EXPIRED = "session_expired",
  UNKNOWN_OR_EXPIRED_DUEL = "unknown_or_expired_duel",
  PLAYER_ADDRESS_MISMATCH = "player_address_mismatch",
  CHALLENGE_EXPIRED = "challenge_expired",
  BAD_SIGNATURE = "bad_signature",
  MISSING_PLAYER = "missing_player",
  MISSING_TX_HASH = "missing_tx_hash",
  INVALID_PLAYER_ADDRESS = "invalid_player_address",
  SERVER_MISSING_CUSD_ENV = "server_missing_cusd_env",
  MISCONFIGURED_TOPUP_TREASURY = "misconfigured_topup_treasury",
  TRANSACTION_NOT_FOUND_OR_FAILED = "transaction_not_found_or_failed",
  TRANSFER_MISMATCH = "transfer_mismatch_or_insufficient_amount",
  TX_ALREADY_CONSUMED = "tx_already_consumed",
  INTERNAL_TOPUP_FAILURE = "internal_topup_failure",
  AI_MOVE_FAILED = "ai_move_failed",
  ILLEGAL_CARD_FOR_SESSION = "illegal_card_for_session",
  CARD_ALREADY_USED = "card_already_used",
  ROUND_DEADLINE_PASSED = "round_deadline_passed",
  DUEL_ALREADY_COMPLETE = "duel_already_complete",
  GAME_NOT_ELIGIBLE_FOR_REWARD = "Game not eligible for reward",
  INCOMPLETE_TRANSCRIPT = "Incomplete duel transcript",
  REWARD_ALREADY_CLAIMED = "reward_already_claimed_for_session",
  RESOLVE_ALREADY_ISSUED = "resolve_already_issued",
  MISSING_DUEL_ID = "missing_duel_id",
  DUEL_NOT_COMPLETE = "duel_not_complete",
  DUEL_NOT_ACTIVE = "duel_not_active",
  DUEL_NOT_JOINED_YET = "duel_not_joined_yet",
  SERVER_MISCONFIGURED = "Server misconfigured",
  INTERNAL_ERROR = "internal_error",
}

// ── AI Duel Endpoints ───────────────────────────────────────────────────────

export interface StartDuelChallengeResponse {
  nonce: string;
  message: string;
}

export interface StartDuelRequest {
  playerAddress: string;
  signature: string;
}

export interface StartDuelResponse {
  duelId: string;
  hand: Card[];
  dealtPool: Card[];
  aiHintType: AiHintType;
  expiresAtMs?: number;
}

export interface AiMoveRequest {
  duelId: string;
  playerCard: Card;
}

export interface ApiPublicState {
  playerHp: number;
  aiHp: number;
  turn: number;
  isOver: boolean;
  playerWon: boolean | null;
  lastTurn: TurnResult | null;
  perfectDuelBonus?: boolean;
  rewardTier?: string;
}

export interface AiMoveResponse {
  card: Card;
  reasoning: string;
  state: ApiPublicState;
  nextAiHintType?: AiHintType;
}

export interface ClaimRewardsRequest {
  playerAddress: string;
  duelId: string;
}

export interface ClaimRewardsResponse {
  nonce: string;
  signature: string;
  amountWei?: string;
  amountCusd?: string;
  tier?: string;
  flavor?: string;
  expiresAtMs?: number;
}

export interface PlayerStateResponse {
  lives: number;
  bonusLives: number;
  nextRechargeAt: number | null;
  totalWins: number;
  maxLives: number;
}

export interface TopupEnergyRequest {
  txHash: string;
  playerAddress: string;
}

export interface TopupEnergyResponse {
  ok: boolean;
  bonusGrant: number;
}

// ── PvP Endpoints ────────────────────────────────────────────────────────────

export interface PvpAuthChallengeResponse {
  nonce: string;
  message: string;
}

export interface PvpAuthVerifyRequest {
  duelId: string;
  playerAddress: string;
  signature: string;
}

export interface PvpAuthVerifyResponse {
  token: string;
  slot: "p1" | "p2";
}

export interface PvpMoveRequest {
  duelId: string;
  address: string;
  token: string;
  cardId: string;
}

export interface PvpPublicView {
  round: number;
  yourHp: number;
  opponentHp: number;
  yourHand: Card[];
  usedCardIds: string[];
  youSubmitted: boolean;
  opponentSubmitted: boolean;
  isOver: boolean;
  youWon: boolean | null;
  roundDeadlineMs: number;
  lastRound: {
    round: number;
    sudden: boolean;
    yourCard: Card;
    opponentCard: Card;
    yourDamageDealt: number;
    opponentDamageDealt: number;
  } | null;
}

export interface PvpStateResponse {
  state: PvpPublicView;
}

export interface PvpSignResolveRequest {
  duelId: string;
}

export interface PvpSignResolveResponse {
  duelId: string;
  winner: string;
  winnerSlot: "p1" | "p2" | null;
  nonce: string;
  signature: string;
  player1: string;
  player2: string;
}
