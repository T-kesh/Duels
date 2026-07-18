// Owner-only: update rewardAmount on the deployed DuelRewards contract.
//
// Usage:
//   npx hardhat run scripts/set-reward-amount.cjs --network celo
//   NEW_REWARD_CUSD=0.01 npx hardhat run scripts/set-reward-amount.cjs --network celo
//
// Reads current state first, then sends setRewardAmount and re-reads to
// confirm. PRIVATE_KEY in .env.local must be the contract owner.
const hre = require("hardhat");

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_DUEL_REWARDS_ADDRESS ||
  "0x077E207a9DAAE8Fb1c425906E0607A1a61e187F1";

const NEW_REWARD_CUSD = process.env.NEW_REWARD_CUSD || "0.005";

const ABI = [
  "function owner() view returns (address)",
  "function rewardAmount() view returns (uint256)",
  "function poolBalance() view returns (uint256)",
  "function setRewardAmount(uint256 _amount)",
];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const contract = new hre.ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  const [owner, current, pool] = await Promise.all([
    contract.owner(),
    contract.rewardAmount(),
    contract.poolBalance(),
  ]);

  console.log("Contract:      ", CONTRACT_ADDRESS);
  console.log("Signer:        ", signer.address);
  console.log("Owner:         ", owner);
  console.log("Pool balance:  ", hre.ethers.formatEther(pool), "cUSD");
  console.log("Current reward:", hre.ethers.formatEther(current), "cUSD");

  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error("Signer is not the contract owner — aborting.");
  }

  const newAmount = hre.ethers.parseEther(NEW_REWARD_CUSD);
  if (newAmount === current) {
    console.log("Reward already set to", NEW_REWARD_CUSD, "cUSD — nothing to do.");
    return;
  }

  console.log(`\nSetting rewardAmount to ${NEW_REWARD_CUSD} cUSD…`);
  const tx = await contract.setRewardAmount(newAmount);
  console.log("Tx:", tx.hash);
  await tx.wait();

  // Public RPC endpoints load-balance across nodes; a read immediately after
  // the tx can hit a node that hasn't caught up yet. Retry until it reflects.
  let updated = await contract.rewardAmount();
  for (let attempt = 0; attempt < 5 && updated !== newAmount; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    updated = await contract.rewardAmount();
  }
  console.log("New reward:    ", hre.ethers.formatEther(updated), "cUSD");
  if (updated !== newAmount) {
    console.warn("Read still shows the old value — likely RPC lag; re-run check-contract.cjs in a minute.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
