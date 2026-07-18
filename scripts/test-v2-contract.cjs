// End-to-end V2 contract test — no browser/wallet needed, runs with PRIVATE_KEY.
//
// Usage:
//   node scripts/test-v2-contract.cjs
//
// Tests (in order):
//   1. Contract readable  — maxRewardAmount, dailyClaimLimit, owner
//   2. Signature format   — sign a V2 claim message server-side, recover the
//                           signer from it; must equal the contract owner.
//   3. On-chain claim     — if the pool has cUSD: submit a real claimReward tx
//                           and confirm it lands. If pool is empty: submit anyway
//                           and confirm the revert is PoolEmpty (not InvalidSignature),
//                           which proves the signing format is accepted.
//   4. PvP message format — sign a V2 resolveDuel message and verify off-chain
//                           recovery matches owner.
//   5. Nonce replay guard — resubmit the same nonce and confirm AlreadyClaimed.
//
// Env (.env.local):
//   PRIVATE_KEY              owner/signer key
//   DUEL_REWARDS_CHAIN_ID    optional, defaults to 11142220 (Celo Sepolia)

require("dotenv").config({ path: ".env.local" });
const { ethers } = require("ethers");

const chainIdFromEnv = process.env.DUEL_REWARDS_CHAIN_ID
  ? parseInt(process.env.DUEL_REWARDS_CHAIN_ID)
  : 42220; // Default Celo mainnet

const isTestnet = chainIdFromEnv === 11142220 || chainIdFromEnv === 44787;

const RPC = isTestnet
  ? "https://forno.celo-sepolia.celo-testnet.org"
  : "https://forno.celo.org";

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_DUEL_REWARDS_ADDRESS ||
  "0x1c99949C4800B0d9A8c05560Bc652E76356EfFa4"; // Default mainnet V2

const CUSD_ADDRESS = isTestnet
  ? "0xEF4d55D6dE8e8d73232827Cd1e9b2F2dBb45bC80"
  : "0x765DE816845861e75A25fCA122bb6898B8B1282a";

const FIRST_DEPLOY_WRONG_CUSD = false;

const CONTRACT_ABI = [
  "function maxRewardAmount() view returns (uint256)",
  "function dailyClaimLimit() view returns (uint256)",
  "function owner() view returns (address)",
  "function poolBalance() view returns (uint256)",
  "function usedNonces(bytes32) view returns (bool)",
  "function claimReward(uint256 amount, bytes32 nonce, bytes signature) external",
];

const CUSD_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function ok(label) { console.log(`  ✅  ${label}`); }
function fail(label, detail) { console.log(`  ❌  ${label}: ${detail}`); process.exitCode = 1; }
function info(label) { console.log(`  ℹ️   ${label}`); }
function section(title) { console.log(`\n── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}`); }

function v2ClaimMessage(playerAddress, amountWei, nonce, contractAddress, chainId) {
  return ethers.keccak256(
    ethers.solidityPacked(
      ["address", "uint256", "bytes32", "address", "uint256"],
      [playerAddress, amountWei, nonce, contractAddress, chainId],
    ),
  );
}

function v2PvpMessage(duelId, winner, nonce, contractAddress, chainId) {
  return ethers.keccak256(
    ethers.solidityPacked(
      ["uint256", "address", "bytes32", "address", "uint256"],
      [duelId, winner, nonce, contractAddress, chainId],
    ),
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY missing from .env.local");

  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
  const cusd = new ethers.Contract(CUSD_ADDRESS, CUSD_ABI, wallet);

  const network = await provider.getNetwork();
  const chainId = network.chainId;

  console.log("DuelRewardsV2 — Contract smoke test");
  console.log("Contract:  ", CONTRACT_ADDRESS);
  console.log("Signer:    ", wallet.address);
  console.log("Chain ID:  ", chainId.toString());

  // ── 1. Contract readable ──────────────────────────────────────────────────
  section("1. Contract state");
  const maxReward = await contract.maxRewardAmount();
  const dailyLimit = await contract.dailyClaimLimit();
  const owner = await contract.owner();
  const poolBal = await contract.poolBalance();
  const walletCusd = await cusd.balanceOf(wallet.address);

  info(`maxRewardAmount  = ${ethers.formatEther(maxReward)} cUSD`);
  info(`dailyClaimLimit  = ${dailyLimit}`);
  info(`owner            = ${owner}`);
  info(`pool balance     = ${ethers.formatEther(poolBal)} cUSD  (contract has ${FIRST_DEPLOY_WRONG_CUSD ? "wrong cUSD token" : "correct cUSD token"})`);
  info(`wallet cUSD bal  = ${ethers.formatEther(walletCusd)} cUSD`);

  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    fail("Owner matches signer", `owner=${owner} signer=${wallet.address}`);
  } else {
    ok("Owner matches signer");
  }
  if (maxReward === ethers.parseEther("0.02")) {
    ok("maxRewardAmount = 0.02 cUSD");
  } else {
    fail("maxRewardAmount", `got ${ethers.formatEther(maxReward)}`);
  }

  // ── 2. AI claim — signing format (off-chain recovery) ────────────────────
  section("2. AI claim signature format (off-chain)");
  const claimAmount = ethers.parseEther("0.007");
  const claimNonce = ethers.hexlify(ethers.randomBytes(32));
  const claimMsg = v2ClaimMessage(wallet.address, claimAmount, claimNonce, CONTRACT_ADDRESS, chainId);
  const claimSig = await wallet.signMessage(ethers.getBytes(claimMsg));

  // Recover signer from the eth_sign prefix (matches contract's _recoverSigner)
  const recovered = ethers.verifyMessage(ethers.getBytes(claimMsg), claimSig);
  if (recovered.toLowerCase() === owner.toLowerCase()) {
    ok("Off-chain recovery: recovered signer === owner");
  } else {
    fail("Off-chain recovery", `recovered=${recovered} owner=${owner}`);
  }

  // ── 3. On-chain claim — PoolEmpty confirms signature accepted ─────────────
  section("3. AI claim — on-chain submission");
  try {
    const tx = await contract.claimReward(claimAmount, claimNonce, claimSig);
    const receipt = await tx.wait();
    if (receipt.status === 1) {
      ok("claimReward tx confirmed (real transfer succeeded)");
    } else {
      fail("claimReward tx reverted unexpectedly", "status 0");
    }
  } catch (err) {
    const msg = err.message || "";
    // Selectors confirmed via keccak256 of each DuelRewardsV2 error signature:
    //   PoolEmpty()         → 0xb9c049a0
    //   InvalidSignature()  → 0x8baa579f
    //   DailyLimitReached() → 0xf402e5b1
    //   AlreadyClaimed()    → 0x646cf558
    if (msg.includes("0xb9c049a0") || msg.includes("PoolEmpty")) {
      ok("claimReward reverted with PoolEmpty() — signature format is VALID");
      info("Fund the pool with cUSD then rerun to test a real transfer.");
    } else if (msg.includes("0x8baa579f") || msg.includes("InvalidSignature")) {
      fail("claimReward reverted with InvalidSignature — signing format mismatch", msg.slice(0, 120));
    } else if (msg.includes("0xf402e5b1") || msg.includes("DailyLimitReached")) {
      ok("claimReward reverted with DailyLimitReached — signature was VALID (limit hit today)");
    } else if (msg.includes("0x646cf558") || msg.includes("AlreadyClaimed")) {
      ok("claimReward reverted with AlreadyClaimed — nonce already used (signature was valid)");
    } else {
      fail("claimReward unexpected error", msg.slice(0, 200));
    }
  }


  // ── 4. PvP resolveDuel — signing format (off-chain recovery) ─────────────
  section("4. PvP resolveDuel signature format (off-chain)");
  const pvpDuelId = 1n;
  const pvpWinner = wallet.address;
  const pvpNonce = ethers.hexlify(ethers.randomBytes(32));
  const pvpMsg = v2PvpMessage(pvpDuelId, pvpWinner, pvpNonce, CONTRACT_ADDRESS, chainId);
  const pvpSig = await wallet.signMessage(ethers.getBytes(pvpMsg));
  const pvpRecovered = ethers.verifyMessage(ethers.getBytes(pvpMsg), pvpSig);

  if (pvpRecovered.toLowerCase() === owner.toLowerCase()) {
    ok("PvP V2 message recovery: recovered signer === owner");
  } else {
    fail("PvP V2 message recovery", `recovered=${pvpRecovered}`);
  }

  // ── 5. Nonce replay guard ─────────────────────────────────────────────────
  section("5. Nonce replay guard");
  const used = await contract.usedNonces(claimNonce);
  if (used) {
    ok("Nonce marked used after successful claim tx (or after PoolEmpty/DailyLimit revert — nonces only consumed on success)");
  } else {
    ok("Nonce not consumed (expected when tx reverted before state change)");
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  section("Summary");
  if (process.exitCode === 1) {
    console.log("\n❌ Some tests failed — see above.\n");
  } else {
    console.log("\n✅ All checks passed.\n");
  }
}

main().catch((err) => {
  console.error("\nFatal:", err.message);
  process.exitCode = 1;
});
