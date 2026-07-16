const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

// Mirrors src/lib/rewardSigner.ts — (claimant, amount, nonce, contract, chainId).
async function signClaim(signer, player, amount, nonce, contractAddress) {
  const { chainId } = await ethers.provider.getNetwork();
  const message = ethers.keccak256(
    ethers.solidityPacked(
      ["address", "uint256", "bytes32", "address", "uint256"],
      [player, amount, nonce, contractAddress, chainId],
    ),
  );
  return signer.signMessage(ethers.getBytes(message));
}

describe("DuelRewardsV2", () => {
  async function deployFixture() {
    const [owner, player, treasury, attacker] = await ethers.getSigners();

    const MockCUSD = await ethers.getContractFactory("MockCUSD");
    const cusd = await MockCUSD.deploy();

    const DuelRewardsV2 = await ethers.getContractFactory("DuelRewardsV2");
    const rewards = await DuelRewardsV2.deploy(await cusd.getAddress(), treasury.address);

    // Fund the pool
    await cusd.mint(await rewards.getAddress(), ethers.parseEther("10"));

    return { owner, player, treasury, attacker, cusd, rewards };
  }

  const AMOUNT = ethers.parseEther("0.01");

  it("pays a signed claim, splitting protocol fee to treasury", async () => {
    const { owner, player, treasury, cusd, rewards } = await loadFixture(deployFixture);
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const sig = await signClaim(owner, player.address, AMOUNT, nonce, await rewards.getAddress());

    await expect(rewards.connect(player).claimReward(AMOUNT, nonce, sig))
      .to.emit(rewards, "RewardClaimed");

    // 10% fee
    expect(await cusd.balanceOf(player.address)).to.equal(ethers.parseEther("0.009"));
    expect(await cusd.balanceOf(treasury.address)).to.equal(ethers.parseEther("0.001"));
    expect(await rewards.totalWins(player.address)).to.equal(1);
  });

  it("rejects a claim whose amount differs from the signed amount", async () => {
    const { owner, player, rewards } = await loadFixture(deployFixture);
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const sig = await signClaim(owner, player.address, AMOUNT, nonce, await rewards.getAddress());

    const inflated = ethers.parseEther("0.02");
    await expect(
      rewards.connect(player).claimReward(inflated, nonce, sig),
    ).to.be.revertedWithCustomError(rewards, "InvalidSignature");
  });

  it("rejects amounts above maxRewardAmount even when correctly signed", async () => {
    const { owner, player, rewards } = await loadFixture(deployFixture);
    const over = ethers.parseEther("0.03"); // max is 0.02
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const sig = await signClaim(owner, player.address, over, nonce, await rewards.getAddress());

    await expect(
      rewards.connect(player).claimReward(over, nonce, sig),
    ).to.be.revertedWithCustomError(rewards, "RewardExceedsMax");
  });

  it("rejects zero-amount claims", async () => {
    const { owner, player, rewards } = await loadFixture(deployFixture);
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const sig = await signClaim(owner, player.address, 0n, nonce, await rewards.getAddress());

    await expect(
      rewards.connect(player).claimReward(0n, nonce, sig),
    ).to.be.revertedWithCustomError(rewards, "ZeroReward");
  });

  it("rejects nonce replay", async () => {
    const { owner, player, rewards } = await loadFixture(deployFixture);
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const sig = await signClaim(owner, player.address, AMOUNT, nonce, await rewards.getAddress());

    await rewards.connect(player).claimReward(AMOUNT, nonce, sig);
    await expect(
      rewards.connect(player).claimReward(AMOUNT, nonce, sig),
    ).to.be.revertedWithCustomError(rewards, "AlreadyClaimed");
  });

  it("rejects a signature minted for a different claimant", async () => {
    const { owner, player, attacker, rewards } = await loadFixture(deployFixture);
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    // Signed for `player`, submitted by `attacker`
    const sig = await signClaim(owner, player.address, AMOUNT, nonce, await rewards.getAddress());

    await expect(
      rewards.connect(attacker).claimReward(AMOUNT, nonce, sig),
    ).to.be.revertedWithCustomError(rewards, "InvalidSignature");
  });

  it("rejects a signature bound to a different contract address", async () => {
    const { owner, player, treasury, cusd, rewards } = await loadFixture(deployFixture);

    // Deploy a second identical contract; a signature for it must not work here.
    const DuelRewardsV2 = await ethers.getContractFactory("DuelRewardsV2");
    const other = await DuelRewardsV2.deploy(await cusd.getAddress(), treasury.address);

    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const sig = await signClaim(owner, player.address, AMOUNT, nonce, await other.getAddress());

    await expect(
      rewards.connect(player).claimReward(AMOUNT, nonce, sig),
    ).to.be.revertedWithCustomError(rewards, "InvalidSignature");
  });

  it("rejects signatures from non-owner signers", async () => {
    const { player, attacker, rewards } = await loadFixture(deployFixture);
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const sig = await signClaim(attacker, player.address, AMOUNT, nonce, await rewards.getAddress());

    await expect(
      rewards.connect(player).claimReward(AMOUNT, nonce, sig),
    ).to.be.revertedWithCustomError(rewards, "InvalidSignature");
  });

  it("enforces the daily claim limit", async () => {
    const { owner, player, rewards } = await loadFixture(deployFixture);
    const addr = await rewards.getAddress();

    for (let i = 0; i < 5; i++) {
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const sig = await signClaim(owner, player.address, AMOUNT, nonce, addr);
      await rewards.connect(player).claimReward(AMOUNT, nonce, sig);
    }

    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const sig = await signClaim(owner, player.address, AMOUNT, nonce, addr);
    await expect(
      rewards.connect(player).claimReward(AMOUNT, nonce, sig),
    ).to.be.revertedWithCustomError(rewards, "DailyLimitReached");
  });

  it("only owner can raise maxRewardAmount", async () => {
    const { player, rewards } = await loadFixture(deployFixture);
    await expect(
      rewards.connect(player).setMaxRewardAmount(ethers.parseEther("1")),
    ).to.be.revertedWithCustomError(rewards, "NotOwner");
  });
});
