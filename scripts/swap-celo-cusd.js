import hre from "hardhat";
import { ethers } from "ethers";

// Celo Sepolia addresses
const BROKER = "0x777A8255cA72412f0d706dc03C9D1987306B4CaD";
const CELO = "0x471EcE3750Da237f93B8E339c536989b8978a438";
const CUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

// Exchange ID for CELO/cUSD pair on Celo Sepolia
// From the successful swap tx we found on the explorer
const EXCHANGE_PROVIDER = "0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901";
const EXCHANGE_ID = "0x3135b662c38265d0655177091f1b647b4fef511103d06c016efdf18b46930d2c";

const BROKER_ABI = [
  "function swapIn(address exchangeProvider, bytes32 exchangeId, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin) returns (uint256)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log("Swapping from account:", signer.address);

  const celoToken = new ethers.Contract(CELO, ERC20_ABI, signer);
  const broker = new ethers.Contract(BROKER, BROKER_ABI, signer);
  const cusdToken = new ethers.Contract(CUSD, ERC20_ABI, signer);

  // Swap 0.5 CELO for cUSD
  const amountIn = ethers.parseEther("0.5");
  const amountOutMin = ethers.parseEther("0.1"); // accept anything above 0.1 cUSD

  console.log("Approving CELO spend...");
  const approveTx = await celoToken.approve(BROKER, amountIn);
  await approveTx.wait();
  console.log("Approved.");

  console.log("Swapping 0.5 CELO for cUSD...");
  const swapTx = await broker.swapIn(
    EXCHANGE_PROVIDER,
    EXCHANGE_ID,
    CELO,
    CUSD,
    amountIn,
    amountOutMin
  );
  await swapTx.wait();
  console.log("Swap complete!");

  const cusdBalance = await cusdToken.balanceOf(signer.address);
  console.log("New cUSD balance:", ethers.formatEther(cusdBalance));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});