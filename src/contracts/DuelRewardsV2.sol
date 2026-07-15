// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title DuelRewardsV2
/// @notice V2 of the AI-duel reward pool. The key change from V1: the payout
/// amount is part of the server-signed claim message, so the backend can vary
/// rewards per duel (CIPHER "generosity" tiers, performance bonuses) without
/// redeploying. `maxRewardAmount` bounds what any single signature can pay,
/// capping the blast radius if the signing key is ever compromised.
contract DuelRewardsV2 {

    // ─── State ───────────────────────────────────────────────────────────────

    address public owner;
    address public treasury;
    IERC20 public immutable cusd;

    /// Hard per-claim ceiling enforced on-chain regardless of what is signed.
    uint256 public maxRewardAmount = 0.02 ether;
    uint256 public dailyClaimLimit = 5;
    uint256 public protocolFeePercent = 10;
    uint256 public nextDuelId = 1;

    struct Duel {
        address player1;
        address player2;
        uint256 wager;
        bool isActive;
    }

    mapping(uint256 => Duel) public duels;
    mapping(address => mapping(uint256 => uint256)) public dailyClaims;
    mapping(bytes32 => bool) public usedNonces;

    mapping(address => uint256) public totalWins;
    mapping(address => bool) public isPlayer;
    address[] public players;

    // ─── Errors ──────────────────────────────────────────────────────────────

    error NotOwner();
    error AlreadyClaimed();
    error InvalidSignature();
    error InvalidSignatureLength();
    error DailyLimitReached();
    error PoolEmpty();
    error TransferFailed();
    error FeeTooHigh();
    error DuelNotActive();
    error NotDuelParticipant();
    error RewardExceedsMax();
    error ZeroReward();

    // ─── Events ──────────────────────────────────────────────────────────────

    event RewardClaimed(address indexed player, uint256 playerAmount, uint256 fee);
    event PoolToppedUp(uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event DuelCreated(uint256 indexed duelId, address indexed player1, uint256 wager);
    event DuelJoined(uint256 indexed duelId, address indexed player2);
    event DuelResolved(uint256 indexed duelId, address indexed winner, uint256 prize);
    event DuelTied(uint256 indexed duelId, uint256 refund);

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _cusd, address _treasury) {
        owner = msg.sender;
        treasury = _treasury;
        cusd = IERC20(_cusd);
    }

    // ─── AI-mode claims (variable amount, server-signed) ─────────────────────

    /// @notice Claim a server-authorized reward. The signed message binds the
    /// claimant, the exact amount, this contract's address, and the chain id —
    /// so a signature can't be replayed on another deployment or chain, nor
    /// re-used with a different amount.
    function claimReward(uint256 amount, bytes32 nonce, bytes memory signature) external {
        if (usedNonces[nonce]) revert AlreadyClaimed();
        if (amount == 0) revert ZeroReward();
        if (amount > maxRewardAmount) revert RewardExceedsMax();

        bytes32 message = keccak256(
            abi.encodePacked(msg.sender, amount, nonce, address(this), block.chainid)
        );
        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message));
        if (_recoverSigner(ethSigned, signature) != owner) revert InvalidSignature();

        uint256 today = block.timestamp / 1 days;
        if (dailyClaims[msg.sender][today] >= dailyClaimLimit) revert DailyLimitReached();

        uint256 fee = (amount * protocolFeePercent) / 100;
        uint256 playerAmount = amount - fee;
        if (cusd.balanceOf(address(this)) < amount) revert PoolEmpty();

        // CEI: all state updates before transfers
        usedNonces[nonce] = true;
        dailyClaims[msg.sender][today]++;
        totalWins[msg.sender]++;
        if (!isPlayer[msg.sender]) {
            players.push(msg.sender);
            isPlayer[msg.sender] = true;
        }

        if (!cusd.transfer(msg.sender, playerAmount)) revert TransferFailed();
        if (!cusd.transfer(treasury, fee)) revert TransferFailed();

        emit RewardClaimed(msg.sender, playerAmount, fee);
    }

    // ─── PvP duels (unchanged from V1) ───────────────────────────────────────

    function createDuel(uint256 amount) external {
        // Requires prior approve() on cUSD
        if (!cusd.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        uint256 duelId = nextDuelId++;
        duels[duelId] = Duel({
            player1: msg.sender,
            player2: address(0),
            wager: amount,
            isActive: true
        });

        emit DuelCreated(duelId, msg.sender, amount);
    }

    function joinDuel(uint256 duelId) external {
        Duel storage duel = duels[duelId];
        if (!duel.isActive || duel.player2 != address(0)) revert DuelNotActive();

        if (!cusd.transferFrom(msg.sender, address(this), duel.wager)) revert TransferFailed();

        duel.player2 = msg.sender;
        emit DuelJoined(duelId, msg.sender);
    }

    function resolveDuel(uint256 duelId, address winner, bytes32 nonce, bytes memory signature) external {
        if (usedNonces[nonce]) revert AlreadyClaimed();
        Duel storage duel = duels[duelId];
        if (!duel.isActive) revert DuelNotActive();

        // Handle a draw game (winner = address(0))
        if (winner == address(0)) {
            bytes32 message = keccak256(
                abi.encodePacked(duelId, winner, nonce, address(this), block.chainid)
            );
            bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message));
            if (_recoverSigner(ethSigned, signature) != owner) revert InvalidSignature();

            uint256 tieFee = (duel.wager * protocolFeePercent) / 100;
            uint256 refund = duel.wager - tieFee;

            duel.isActive = false;
            usedNonces[nonce] = true;

            if (!cusd.transfer(duel.player1, refund)) revert TransferFailed();
            if (!cusd.transfer(duel.player2, refund)) revert TransferFailed();
            if (!cusd.transfer(treasury, tieFee * 2)) revert TransferFailed();

            emit DuelTied(duelId, refund);
            return;
        }

        if (winner != duel.player1 && winner != duel.player2) revert NotDuelParticipant();

        bytes32 winMessage = keccak256(
            abi.encodePacked(duelId, winner, nonce, address(this), block.chainid)
        );
        bytes32 winEthSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", winMessage));
        if (_recoverSigner(winEthSigned, signature) != owner) revert InvalidSignature();

        uint256 totalPot = duel.wager * 2;
        uint256 fee = (totalPot * protocolFeePercent) / 100;
        uint256 prize = totalPot - fee;

        duel.isActive = false;
        usedNonces[nonce] = true;
        totalWins[winner]++;

        if (!cusd.transfer(winner, prize)) revert TransferFailed();
        if (!cusd.transfer(treasury, fee)) revert TransferFailed();

        emit DuelResolved(duelId, winner, prize);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    /// @notice Returns top 10 players sorted by wins. O(n²) — acceptable at MVP scale.
    function getLeaderboard() external view returns (address[] memory addrs, uint256[] memory wins) {
        uint256 total = players.length;
        uint256 count = total > 10 ? 10 : total;

        address[] memory allPlayers = new address[](total);
        uint256[] memory allWins = new uint256[](total);
        for (uint256 i; i < total; ++i) {
            allPlayers[i] = players[i];
            allWins[i] = totalWins[players[i]];
        }

        for (uint256 i; i < total; ++i) {
            for (uint256 j = i + 1; j < total; ++j) {
                if (allWins[j] > allWins[i]) {
                    (allWins[i], allWins[j]) = (allWins[j], allWins[i]);
                    (allPlayers[i], allPlayers[j]) = (allPlayers[j], allPlayers[i]);
                }
            }
        }

        addrs = new address[](count);
        wins = new uint256[](count);
        for (uint256 i; i < count; ++i) {
            addrs[i] = allPlayers[i];
            wins[i] = allWins[i];
        }
    }

    function poolBalance() external view returns (uint256) {
        return cusd.balanceOf(address(this));
    }

    // ─── Owner ───────────────────────────────────────────────────────────────

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setMaxRewardAmount(uint256 _amount) external onlyOwner {
        maxRewardAmount = _amount;
    }

    function setDailyLimit(uint256 _limit) external onlyOwner {
        dailyClaimLimit = _limit;
    }

    function setProtocolFee(uint256 _percent) external onlyOwner {
        if (_percent > 30) revert FeeTooHigh();
        protocolFeePercent = _percent;
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    function withdrawPool(uint256 amount) external onlyOwner {
        if (!cusd.transfer(owner, amount)) revert TransferFailed();
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _recoverSigner(bytes32 ethSignedMessageHash, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) revert InvalidSignatureLength();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        return ecrecover(ethSignedMessageHash, v, r, s);
    }
}
