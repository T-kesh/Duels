const { createWalletClient, createPublicClient, http, parseEther } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { celoAlfajores } = require("viem/chains");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: ".env.local" });

const privateKey = process.env.PRIVATE_KEY;

if (!privateKey) {
  console.error("ERROR: PRIVATE_KEY is not set in .env.local");
  process.exit(1);
}

const account = privateKeyToAccount(
  privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
);

const transport = http();

const publicClient = createPublicClient({
  chain: celoAlfajores,
  transport,
});

const walletClient = createWalletClient({
  account,
  chain: celoAlfajores,
  transport,
});

async function main() {
  console.log(`Deploying from account: ${account.address}`);
  
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Account balance: ${balance} wei`);
  
  if (balance === 0n) {
    console.warn("WARNING: Account balance is 0. Deployment might fail if you don't have CELO.");
  }

  const testnetCUSD = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1";
  const treasury = account.address; // Defaulting to deployer

  console.log(`Using cUSD: ${testnetCUSD}`);
  console.log(`Using Treasury: ${treasury}`);

  const contractJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, "DuelRewards.json"), "utf8"));
  
  const abi = contractJson.abi;
  const bytecode = contractJson.bytecode.startsWith("0x") ? contractJson.bytecode : `0x${contractJson.bytecode}`;

  console.log("Submitting deployment transaction...");
  try {
    const hash = await walletClient.deployContract({
      abi,
      bytecode,
      args: [testnetCUSD, treasury],
    });

    console.log(`Transaction Hash: ${hash}`);
    
    console.log("Waiting for block confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    console.log(`Contract deployed!`);
    console.log(`Address: ${receipt.contractAddress}`);
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

main();
