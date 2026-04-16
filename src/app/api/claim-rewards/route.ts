import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

export async function POST(req: NextRequest) {
  try {
    const { playerAddress } = await req.json();

    if (!playerAddress) {
      return NextResponse.json({ error: "Missing player address" }, { status: 400 });
    }

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    // Create a unique nonce using player address + timestamp
    const nonce = ethers.keccak256(
      ethers.solidityPacked(
        ["address", "uint256"],
        [playerAddress, Date.now()]
      )
    );

    // Sign the same message the contract verifies:
    // keccak256(abi.encodePacked(msg.sender, nonce))
    const wallet = new ethers.Wallet(privateKey);
    const message = ethers.keccak256(
      ethers.solidityPacked(
        ["address", "bytes32"],
        [playerAddress, nonce]
      )
    );

    const signature = await wallet.signMessage(ethers.getBytes(message));

    return NextResponse.json({ nonce, signature });
  } catch (err) {
    console.error("claim-reward error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}