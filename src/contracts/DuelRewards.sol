// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract DuelRewards {
    address public owner;
    address public treasury;
    IERC20 public cusd;

    uint256 public rewardAmount = 0.05 ether;
    uint256 public dailyClaimLimit = 5;
    uint256 public protocolFeePercent = 10; // 10% to treasury

    // Daily claim tracking
    mapping(address => mapping(uint256 => uint256)) public dailyClaims;

    // Replay protection
    mapping(bytes32 => bool) public usedNonces;

    // Onchain leaderboard
    mapping(address => uint256) public totalWins;
    address[] public players;
    mapping(address => bool) public isPlayer;

    event RewardClaimed(address indexed player, uint256 playerAmount, uint256 fee);
    event PoolToppedUp(uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _cusd, address _treasury) {
        owner = msg.sender;
        treasury = _treasury;
        cusd = IERC20(_cusd);
    }

    function claimReward(bytes32 nonce, bytes memory signature) external {
        // Replay protection
        require(!usedNonces[nonce], "Already claimed");

        // Verify owner signed this claim
        bytes32 message = keccak256(abi.encodePacked(msg.sender, nonce));
        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message));
        require(_recoverSigner(ethSigned, signature) == owner, "Invalid signature");

        // Daily limit
        uint256 today = block.timestamp / 1 days;
        require(dailyClaims[msg.sender][today] < dailyClaimLimit, "Daily limit reached");

        // Pool check
        uint256 fee = (rewardAmount * protocolFeePercent) / 100;
        uint256 playerAmount = rewardAmount - fee;
        require(cusd.balanceOf(address(this)) >= rewardAmount, "Pool empty");

        // Mark used
        usedNonces[nonce] = true;
        dailyClaims[msg.sender][today]++;

        // Track wins for leaderboard
        if (!isPlayer[msg.sender]) {
            players.push(msg.sender);
            isPlayer[msg.sender] = true;
        }
        totalWins[msg.sender]++;

        // Pay player and treasury
        require(cusd.transfer(msg.sender, playerAmount), "Player transfer failed");
        require(cusd.transfer(treasury, fee), "Fee transfer failed");

        emit RewardClaimed(msg.sender, playerAmount, fee);
    }

    // Read leaderboard — returns top 10 players and their wins
    function getLeaderboard() external view returns (address[] memory addrs, uint256[] memory wins) {
        uint256 count = players.length > 10 ? 10 : players.length;
        addrs = new address[](count);
        wins = new uint256[](count);

        // Copy players array
        address[] memory allPlayers = new address[](players.length);
        uint256[] memory allWins = new uint256[](players.length);
        for (uint256 i = 0; i < players.length; i++) {
            allPlayers[i] = players[i];
            allWins[i] = totalWins[players[i]];
        }

        // Simple bubble sort (fine for small arrays at MVP scale)
        for (uint256 i = 0; i < allPlayers.length; i++) {
            for (uint256 j = i + 1; j < allPlayers.length; j++) {
                if (allWins[j] > allWins[i]) {
                    (allWins[i], allWins[j]) = (allWins[j], allWins[i]);
                    (allPlayers[i], allPlayers[j]) = (allPlayers[j], allPlayers[i]);
                }
            }
        }

        for (uint256 i = 0; i < count; i++) {
            addrs[i] = allPlayers[i];
            wins[i] = allWins[i];
        }
    }

    function poolBalance() external view returns (uint256) {
        return cusd.balanceOf(address(this));
    }

    function setRewardAmount(uint256 _amount) external onlyOwner {
        rewardAmount = _amount;
    }

    function setDailyLimit(uint256 _limit) external onlyOwner {
        dailyClaimLimit = _limit;
    }

    function setProtocolFee(uint256 _percent) external onlyOwner {
        require(_percent <= 30, "Max 30%");
        protocolFeePercent = _percent;
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    function withdrawPool(uint256 amount) external onlyOwner {
        require(cusd.transfer(owner, amount), "Transfer failed");
    }

    function _recoverSigner(bytes32 ethSignedMessageHash, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid sig length");
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