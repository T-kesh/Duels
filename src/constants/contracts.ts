export const DUEL_REWARDS_ADDRESS =
  process.env.NEXT_PUBLIC_DUEL_REWARDS_ADDRESS ||
  "0x077E207a9DAAE8Fb1c425906E0607A1a61e187F1";

/**
 * Contract generation switch. "1" = legacy fixed-amount claimReward(nonce,
 * sig); "2" = DuelRewardsV2 variable-amount claimReward(amount, nonce, sig).
 * Set NEXT_PUBLIC_DUEL_REWARDS_VERSION=2 together with the V2 address after
 * deploying — server (claim-rewards route) and client (useClaimReward) both
 * key off this so they can't drift apart.
 */
export const DUEL_REWARDS_VERSION =
  (process.env.NEXT_PUBLIC_DUEL_REWARDS_VERSION || "1") === "2" ? 2 : 1;

export const DUEL_REWARDS_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "duelId", type: "uint256" },
      { indexed: true, internalType: "address", name: "player1", type: "address" },
      { indexed: false, internalType: "uint256", name: "wager", type: "uint256" },
    ],
    name: "DuelCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "duelId", type: "uint256" },
      { indexed: true, internalType: "address", name: "player2", type: "address" },
    ],
    name: "DuelJoined",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "duelId", type: "uint256" },
      { indexed: true, internalType: "address", name: "winner", type: "address" },
      { indexed: false, internalType: "uint256", name: "prize", type: "uint256" },
    ],
    name: "DuelResolved",
    type: "event",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "nonce", type: "bytes32" },
      { internalType: "bytes", name: "signature", type: "bytes" },
    ],
    name: "claimReward",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getLeaderboard",
    outputs: [
      { internalType: "address[]", name: "addrs", type: "address[]" },
      { internalType: "uint256[]", name: "wins", type: "uint256[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "poolBalance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "rewardAmount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "totalWins",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "treasury",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextDuelId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "duels",
    outputs: [
      { internalType: "address", name: "player1", type: "address" },
      { internalType: "address", name: "player2", type: "address" },
      { internalType: "uint256", name: "wager", type: "uint256" },
      { internalType: "bool", name: "isActive", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    name: "createDuel",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "duelId", type: "uint256" }],
    name: "joinDuel",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "duelId", type: "uint256" },
      { internalType: "address", name: "winner", type: "address" },
      { internalType: "bytes32", name: "nonce", type: "bytes32" },
      { internalType: "bytes", name: "signature", type: "bytes" },
    ],
    name: "resolveDuel",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/**
 * DuelRewardsV2 additions/changes vs V1: claimReward takes the signed amount,
 * and maxRewardAmount replaces the fixed rewardAmount. Spread onto the shared
 * views (leaderboard, duels, pvp) which are unchanged.
 */
export const DUEL_REWARDS_V2_ABI = [
  ...DUEL_REWARDS_ABI.filter(
    (e) => !("name" in e) || (e.name !== "claimReward" && e.name !== "rewardAmount"),
  ),
  {
    inputs: [
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "bytes32", name: "nonce", type: "bytes32" },
      { internalType: "bytes", name: "signature", type: "bytes" },
    ],
    name: "claimReward",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "maxRewardAmount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
