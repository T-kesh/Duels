const hre = require("hardhat");

async function main() {
  // Address can be overridden via env so this script works against both
  // V1 (legacy fixed-amount) and V2 (variable-amount) deployments without
  // editing the file. Set NEXT_PUBLIC_DUEL_REWARDS_ADDRESS in .env.local.
  const address =
    process.env.NEXT_PUBLIC_DUEL_REWARDS_ADDRESS ||
    "0x077E207a9DAAE8Fb1c425906E0607A1a61e187F1";
  const version = process.env.NEXT_PUBLIC_DUEL_REWARDS_VERSION || "1";

  const code = await hre.ethers.provider.getCode(address);
  if (code === "0x") {
    console.log("No contract found at", address);
    return;
  }

  console.log("Contract found at", address, `(V${version})`);

  const isV2 = version === "2";
  const DUEL_REWARDS_ABI = [
    "function poolBalance() view returns (uint256)",
    isV2
      ? "function maxRewardAmount() view returns (uint256)"
      : "function rewardAmount() view returns (uint256)",
  ];
  const contract = new hre.ethers.Contract(address, DUEL_REWARDS_ABI, hre.ethers.provider);
  try {
    const balance = await contract.poolBalance();
    console.log("Pool Balance:  ", hre.ethers.formatEther(balance), "cUSD");
    if (isV2) {
      const max = await contract.maxRewardAmount();
      console.log("Max Reward:    ", hre.ethers.formatEther(max), "cUSD");
    } else {
      const reward = await contract.rewardAmount();
      console.log("Reward Amount: ", hre.ethers.formatEther(reward), "cUSD");
    }
  } catch (e) {
    console.log("Error calling contract:", e.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
