// Deploy DuelRewardsV2.
//
// Usage:
//   npx hardhat run scripts/deploy-v2.cjs --network celo
//   npx hardhat run scripts/deploy-v2.cjs --network alfajores
//
// Env (.env.local):
//   PRIVATE_KEY           deployer & reward-signing key (becomes owner)
//   CUSD_TOKEN_ADDRESS    cUSD token address for the target network
//   TOPUP_TREASURY        protocol-fee treasury (defaults to deployer)
//
// After deploying: set NEXT_PUBLIC_DUEL_REWARDS_ADDRESS to the new address
// and fund the pool by transferring cUSD to it.
const hre = require("hardhat");

// Canonical cUSD per network, used when CUSD_TOKEN_ADDRESS is unset.
const DEFAULT_CUSD = {
  celo:        "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  alfajores:   "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
  // Celo Sepolia testnet (current recommended testnet; Alfajores forno is DNS-dead).
  // Verify at https://sepolia.celoscan.io before deploying.
  celoSepolia: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B",
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  const cusd = process.env.CUSD_TOKEN_ADDRESS || DEFAULT_CUSD[network];
  if (!cusd) {
    throw new Error(`No cUSD address known for network "${network}" — set CUSD_TOKEN_ADDRESS.`);
  }
  const treasury = process.env.TOPUP_TREASURY || deployer.address;

  console.log("Network:  ", network);
  console.log("Deployer: ", deployer.address);
  console.log("cUSD:     ", cusd);
  console.log("Treasury: ", treasury);

  const factory = await hre.ethers.getContractFactory("DuelRewardsV2");
  const contract = await factory.deploy(cusd, treasury);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\nDuelRewardsV2 deployed:", address);

  // Public RPC nodes can take a few seconds to index fresh bytecode.
  // Calling view functions immediately returns 0x (BAD_DATA). Wait briefly.
  process.stdout.write("Waiting for RPC indexing");
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    process.stdout.write(".");
  }
  console.log(" done");

  console.log("maxRewardAmount:", hre.ethers.formatEther(await contract.maxRewardAmount()), "cUSD");
  console.log("dailyClaimLimit:", (await contract.dailyClaimLimit()).toString());

  console.log("\nNext steps:");
  console.log(`  1. Set NEXT_PUBLIC_DUEL_REWARDS_ADDRESS=${address}`);
  console.log("  2. Set NEXT_PUBLIC_DUEL_REWARDS_VERSION=2 (enables variable-amount claims)");
  console.log("  3. Fund the pool: transfer cUSD to the contract address");
  console.log(`  4. Verify: npx hardhat verify --network ${network} ${address} ${cusd} ${treasury}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
