// Withdraw the remaining cUSD pool from the V1 DuelRewards contract.
// Run AFTER deploying V2 and before topping up the V2 pool.
//
// Usage:
//   npx hardhat run scripts/withdraw-v1-pool.cjs --network celo
//
// Env (.env.local):
//   PRIVATE_KEY  — must be the V1 contract owner
//
// The script reads the live pool balance, prints it, then calls
// withdrawPool(balance) to send everything to the owner wallet.
// Exits with code 1 if the pool is already empty.
const hre = require("hardhat");

const V1_ADDRESS = "0x077E207a9DAAE8Fb1c425906E0607A1a61e187F1";

const ABI = [
  "function poolBalance() view returns (uint256)",
  "function withdrawPool(uint256 amount) external",
  "function owner() view returns (address)",
];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const contract = new hre.ethers.Contract(V1_ADDRESS, ABI, signer);

  const owner = await contract.owner();
  console.log("V1 contract:  ", V1_ADDRESS);
  console.log("Owner:        ", owner);
  console.log("Signer:       ", signer.address);

  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(
      `Signer ${signer.address} is not the owner ${owner}. ` +
        "Ensure PRIVATE_KEY in .env.local matches the contract owner.",
    );
  }

  const balance = await contract.poolBalance();
  console.log("Pool balance: ", hre.ethers.formatEther(balance), "cUSD");

  if (balance === 0n) {
    console.log("Pool is already empty — nothing to withdraw.");
    return;
  }

  console.log(`\nWithdrawing ${hre.ethers.formatEther(balance)} cUSD to ${signer.address}...`);
  const tx = await contract.withdrawPool(balance);
  console.log("Tx:          ", tx.hash);
  await tx.wait();

  const remaining = await contract.poolBalance();
  console.log("Remaining:   ", hre.ethers.formatEther(remaining), "cUSD");
  console.log("\nWithdrawal complete. Transfer these funds to the V2 pool.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
