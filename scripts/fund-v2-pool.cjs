// Fund the V2 DuelRewards contract pool with cUSD from the deployer/owner wallet.
//
// Usage:
//   npx hardhat run scripts/fund-v2-pool.cjs --network celo
//
// Env (.env.local):
//   PRIVATE_KEY                        signer key containing cUSD
//   NEXT_PUBLIC_DUEL_REWARDS_ADDRESS   target contract address
//
const hre = require("hardhat");

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_DUEL_REWARDS_ADDRESS ||
  "0x1c99949C4800B0d9A8c05560Bc652E76356EfFa4";

const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

const CUSD_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const cusd = new hre.ethers.Contract(CUSD_ADDRESS, CUSD_ABI, signer);

  console.log("Funding V2 Contract:", CONTRACT_ADDRESS);
  console.log("Signer Address:     ", signer.address);

  const walletBal = await cusd.balanceOf(signer.address);
  console.log("Wallet cUSD Balance:", hre.ethers.formatEther(walletBal), "cUSD");

  if (walletBal === 0n) {
    throw new Error("No cUSD available in wallet to fund the contract.");
  }

  // Fund the pool with most of the balance, leaving a small buffer
  const fundAmount = walletBal - hre.ethers.parseEther("0.01");
  if (fundAmount <= 0n) {
    throw new Error("cUSD balance too small to fund.");
  }

  console.log(`\nTransferring ${hre.ethers.formatEther(fundAmount)} cUSD to V2 contract...`);
  const tx = await cusd.transfer(CONTRACT_ADDRESS, fundAmount);
  console.log("Tx hash:            ", tx.hash);
  await tx.wait();

  console.log("\nFunding completed successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
