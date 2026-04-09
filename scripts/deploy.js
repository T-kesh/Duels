import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  if (!deployer) {
    throw new Error("No deployer account found. Please ensure you have set PRIVATE_KEY in .env.local");
  }

  console.log("Deploying contracts with the account:", deployer.address);

  // Celo Alfajores Testnet cUSD address
  const testnetCUSD = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1";
  
  // We use the deployer as the treasury for the testnet deployment
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