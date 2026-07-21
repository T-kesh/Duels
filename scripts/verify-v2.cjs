// Helper script to verify DuelRewardsV2 on Celoscan / Etherscan V2 API
//
// Usage:
//   npx hardhat run scripts/verify-v2.cjs --network celo
//
// Require ETHERSCAN_API_KEY in .env.local (obtain free key from https://etherscan.io/myapikey)

require("dotenv").config({ path: ".env.local" });
const hre = require("hardhat");

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_DUEL_REWARDS_ADDRESS ||
  "0x1c99949C4800B0d9A8c05560Bc652E76356EfFa4";

const CUSD_ADDRESS =
  process.env.NEXT_PUBLIC_CUSD_ADDRESS ||
  "0x765DE816845861e75A25fCA122bb6898B8B1282a";

const TREASURY_ADDRESS =
  process.env.TOPUP_TREASURY ||
  "0xaEea89C8ac328CAD629f4F7F4F93a3C2cEB0F148";

async function main() {
  const apiKey = process.env.ETHERSCAN_API_KEY || process.env.CELOSCAN_API_KEY;

  console.log("Verifying DuelRewardsV2...");
  console.log("Contract Address:", CONTRACT_ADDRESS);
  console.log("cUSD Address:    ", CUSD_ADDRESS);
  console.log("Treasury Address:", TREASURY_ADDRESS);

  if (!apiKey) {
    console.log("\n⚠️  No ETHERSCAN_API_KEY found in .env.local");
    console.log("Etherscan/Celoscan V2 API requires a free Etherscan API key.");
    console.log("1. Get a free API key at https://etherscan.io/myapikey");
    console.log("2. Add ETHERSCAN_API_KEY=your_key_here to .env.local");
    console.log("3. Re-run: npx hardhat run scripts/verify-v2.cjs --network celo\n");
    console.log("Alternatively, verify manually on Celoscan UI (https://celoscan.io/verifyContract):");
    console.log("  Contract Address:   0x1c99949C4800B0d9A8c05560Bc652E76356EfFa4");
    console.log("  Compiler Version:   v0.8.20+commit.a1b79de6");
    console.log("  Optimization:       No");
    console.log("  Constructor Args:   000000000000000000000000765de816845861e75a25fca122bb6898b8b1282a000000000000000000000000aeea89c8ac328cad629f4f7f4f93a3c2ceb0f148");
    return;
  }

  await hre.run("verify:verify", {
    address: CONTRACT_ADDRESS,
    constructorArguments: [CUSD_ADDRESS, TREASURY_ADDRESS],
  });

  console.log("Verification complete!");
}

main().catch((err) => {
  console.error("Verification failed:", err.message);
  process.exitCode = 1;
});
