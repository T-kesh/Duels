export const DUEL_REWARDS_ADDRESS = "0x077E207a9DAAE8Fb1c425906E0607A1a61e187F1";

export const DUEL_REWARDS_ABI = [
  {
    "inputs": [
      { "internalType": "bytes32", "name": "nonce", "type": "bytes32" },
      { "internalType": "bytes", "name": "signature", "type": "bytes" }
    ],
    "name": "claimReward",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getLeaderboard",
    "outputs": [
      { "internalType": "address[]", "name": "addrs", "type": "address[]" },
      { "internalType": "uint256[]", "name": "wins", "type": "uint256[]" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "poolBalance",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "name": "totalWins",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
