import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  if (!deployer) {
    throw new Error("No deployer account found. Please ensure you have set PRIVATE_KEY in .env.local");
  }

  console.log("Deploying contracts with the account:", deployer.address);

  // Celo Sepolia Testnet cUSD address (same as mainnet)
  const testnetCUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

  // Using deployer as treasury for testnet deployment
  const treasury = deployer.address;

  console.log(`Using cUSD Address: ${testnetCUSD}`);
  console.log(`Using Treasury Address: ${treasury}`);

  const DuelRewards = await hre.ethers.getContractFactory("DuelRewards");
  const duelRewards = await DuelRewards.deploy(testnetCUSD, treasury);

  await duelRewards.waitForDeployment();

  const contractAddress = await duelRewards.getAddress();

  console.log("DuelRewards deployed to:", contractAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});