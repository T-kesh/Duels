const hre = require("hardhat");

async function main() {
  const address = "0x077E207a9DAAE8Fb1c425906E0607A1a61e187F1";
  const code = await hre.ethers.provider.getCode(address);
  if (code === "0x") {
    console.log("No contract found at", address);
  } else {
    console.log("Contract found at", address);
    
    // Check pool balance
    const DUEL_REWARDS_ABI = [
      "function poolBalance() view returns (uint256)",
      "function rewardAmount() view returns (uint256)"
    ];
    const contract = new hre.ethers.Contract(address, DUEL_REWARDS_ABI, hre.ethers.provider);
    try {
        const balance = await contract.poolBalance();
        const reward = await contract.rewardAmount();
        console.log("Pool Balance:", hre.ethers.formatEther(balance), "cUSD");
        console.log("Reward Amount:", hre.ethers.formatEther(reward), "cUSD");
    } catch (e) {
        console.log("Error calling contract:", e.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
