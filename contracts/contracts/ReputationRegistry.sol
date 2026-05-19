// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IReputationRegistry.sol";

/**
 * @title ReputationRegistry
 * @notice Production-grade registry managing Ai agent reputation, earnings, weighted task scoring,
 * anti-manipulation protections, and gas-efficient in-contract leaderboards on Somnia EVM.
 */
contract ReputationRegistry is IReputationRegistry, Ownable, ReentrancyGuard {

    // --- Constants ---

    /// @notice The baseline/initial reputation score assigned to agents (75.0%).
    uint16 public constant BASELINE_REPUTATION = 750;

    /// @notice The absolute maximum reputation score an agent can achieve (100.0%).
    uint16 public constant MAX_REPUTATION = 1000;

    /// @notice The absolute minimum reputation score an agent can drop to.
    uint16 public constant MIN_REPUTATION = 1;

    /// @notice The maximum manual reputation adjustment permitted in a single call to prevent rogue validator dumps.
    uint16 public constant MAX_MANUAL_ADJUSTMENT = 100; // 10.0%

    /// @notice Cooldown period between manual reputation changes by the same validator on the same agent.
    uint256 public constant VALIDATOR_COOLDOWN = 5 minutes;

    /// @notice Maximum size of the leaderboard track.
    uint256 public constant LEADERBOARD_LIMIT = 10;

    // --- State Variables ---

    /// @notice Validator registry determining who can adjust agent reputation.
    mapping(address => bool) public isValidator;

    /// @dev Internal mapping of agent profiles packed into singular storage slots.
    mapping(address => AgentProfile) private _profiles;

    /// @dev Tracking of validator updates to enforce sybil cooldowns (validator => agent => timestamp).
    mapping(address => mapping(address => uint256)) public lastValidatorUpdate;

    /// @dev List of leaderboard agent addresses sorted by reputation.
    address[] private _leaderboard;

    // --- Modifiers ---

    /**
     * @dev Restricts access only to authorized validators or the contract owner.
     */
    modifier onlyValidator() {
        if (!isValidator[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedValidator();
        }
        _;
    }

    /**
     * @dev Ensures the agent is registered and initialized.
     */
    modifier agentExists(address agent) {
        if (!_profiles[agent].isInitialized) {
            revert AgentNotInitialized();
        }
        _;
    }

    // --- Constructor ---

    /**
     * @notice Initializes the ReputationRegistry.
     * @param initialOwner The address of the initial contract owner/administrator.
     */
    constructor(address initialOwner) Ownable(initialOwner) ReentrancyGuard() {
        if (initialOwner == address(0)) {
            revert InvalidAddress();
        }
        // Owner is a default validator
        isValidator[initialOwner] = true;
        emit ValidatorStatusUpdated(initialOwner, true);
    }

    // --- External Functions ---

    /**
     * @notice Registers and initializes an AI agent's profile with baseline reputation.
     * @param agent The address of the agent node to initialize.
     */
    function initializeAgent(address agent) external override onlyValidator {
        if (agent == address(0)) {
            revert InvalidAddress();
        }
        if (_profiles[agent].isInitialized) {
            revert AgentAlreadyInitialized();
        }

        // Write packed storage structure (exactly 1 slot)
        _profiles[agent] = AgentProfile({
            successfulTasks: 0,
            failedTasks: 0,
            reputation: BASELINE_REPUTATION,
            lastUpdated: uint32(block.timestamp),
            totalEarnings: 0,
            isInitialized: true
        });

        emit AgentInitialized(agent, BASELINE_REPUTATION);

        // Update leaderboard
        _updateLeaderboard(agent);
    }

    /**
     * @notice Manually increases an agent's reputation under weighted and authorized validator conditions.
     * @dev Enforces validation cooldowns and size change caps to prevent collusion.
     * @param agent The address of the agent.
     * @param amount The value to increase the reputation by.
     * @param reason A descriptive explanation of the reward action.
     */
    function increaseReputation(
        address agent,
        uint16 amount,
        string calldata reason
    ) external override agentExists(agent) onlyValidator {
        if (amount == 0 || amount > MAX_MANUAL_ADJUSTMENT) {
            revert WeightExceedsLimit();
        }

        // Anti-manipulation validator cooldown check
        uint256 lastUpdate = lastValidatorUpdate[msg.sender][agent];
        if (lastUpdate > 0 && block.timestamp - lastUpdate < VALIDATOR_COOLDOWN) {
            revert CooldownActive();
        }

        AgentProfile storage profile = _profiles[agent];
        uint16 oldRep = profile.reputation;
        
        // Calculate new capped reputation
        uint16 newRep = oldRep + amount;
        if (newRep > MAX_REPUTATION) {
            newRep = MAX_REPUTATION;
        }

        // Apply changes
        profile.reputation = newRep;
        profile.lastUpdated = uint32(block.timestamp);
        lastValidatorUpdate[msg.sender][agent] = block.timestamp;

        emit ReputationUpdated(agent, oldRep, newRep, msg.sender, reason);

        // Update leaderboard position
        _updateLeaderboard(agent);
    }

    /**
     * @notice Manually decreases an agent's reputation under weighted and authorized validator conditions.
     * @dev Enforces validation cooldowns and size change caps to prevent collusion.
     * @param agent The address of the agent.
     * @param amount The value to decrease the reputation by.
     * @param reason A descriptive explanation of the penalty action.
     */
    function decreaseReputation(
        address agent,
        uint16 amount,
        string calldata reason
    ) external override agentExists(agent) onlyValidator {
        if (amount == 0 || amount > MAX_MANUAL_ADJUSTMENT) {
            revert WeightExceedsLimit();
        }

        // Anti-manipulation validator cooldown check
        uint256 lastUpdate = lastValidatorUpdate[msg.sender][agent];
        if (lastUpdate > 0 && block.timestamp - lastUpdate < VALIDATOR_COOLDOWN) {
            revert CooldownActive();
        }

        AgentProfile storage profile = _profiles[agent];
        uint16 oldRep = profile.reputation;

        // Calculate new capped reputation
        uint16 newRep;
        if (amount >= oldRep) {
            newRep = MIN_REPUTATION;
        } else {
            newRep = oldRep - amount;
            if (newRep < MIN_REPUTATION) {
                newRep = MIN_REPUTATION;
            }
        }

        // Apply changes
        profile.reputation = newRep;
        profile.lastUpdated = uint32(block.timestamp);
        lastValidatorUpdate[msg.sender][agent] = block.timestamp;

        emit ReputationUpdated(agent, oldRep, newRep, msg.sender, reason);

        // Update leaderboard position
        _updateLeaderboard(agent);
    }

    /**
     * @notice Automates success scoring for completed tasks, calculating earnings and weighted reputation gains.
     * @dev Task weight bonus scales linearly based on reward size: bonus = reward / 0.1 ether, capped at +20.
     * @param agent The address of the agent.
     * @param rewardAmount The size of the task payout in native wei.
     */
    function recordTaskSuccess(
        address agent,
        uint256 rewardAmount
    ) external override agentExists(agent) onlyValidator {
        AgentProfile storage profile = _profiles[agent];
        uint16 oldRep = profile.reputation;

        // 1. Calculate task complexity weight bonus
        // Each 0.1 ETH reward gives +1 bonus reputation point, capped at 20 points bonus
        uint16 weightBonus = uint16(rewardAmount / 0.1 ether);
        if (weightBonus > 20) {
            weightBonus = 20;
        }

        // Total success increase = 5 baseline + weight bonus (max +25 points)
        uint16 repGain = 5 + weightBonus;
        uint16 newRep = oldRep + repGain;
        if (newRep > MAX_REPUTATION) {
            newRep = MAX_REPUTATION;
        }

        // 2. Perform packed storage updates
        profile.successfulTasks += 1;
        profile.reputation = newRep;
        profile.lastUpdated = uint32(block.timestamp);
        profile.totalEarnings = uint128(uint256(profile.totalEarnings) + rewardAmount);

        emit TaskRecorded(agent, true, rewardAmount, newRep);

        // Update leaderboard
        _updateLeaderboard(agent);
    }

    /**
     * @notice Automates penalty scoring for failed tasks, adjusting metrics and applying weighted reputation losses.
     * @dev Slashes reputation: base failure of -20 points + (weightBonus * 2), capped at -60 points.
     * @param agent The address of the agent.
     * @param rewardAmount The size of the task reward that was lost/slashed in native wei.
     */
    function recordTaskFailure(
        address agent,
        uint256 rewardAmount
    ) external override agentExists(agent) onlyValidator {
        AgentProfile storage profile = _profiles[agent];
        uint16 oldRep = profile.reputation;

        // 1. Calculate task complexity weight bonus penalty
        uint16 weightBonus = uint16(rewardAmount / 0.1 ether);
        if (weightBonus > 20) {
            weightBonus = 20;
        }

        // Total failure penalty = 20 baseline + (weightBonus * 2) (max -60 points)
        uint16 repLoss = 20 + (weightBonus * 2);
        
        uint16 newRep;
        if (repLoss >= oldRep) {
            newRep = MIN_REPUTATION;
        } else {
            newRep = oldRep - repLoss;
            if (newRep < MIN_REPUTATION) {
                newRep = MIN_REPUTATION;
            }
        }

        // 2. Perform packed storage updates
        profile.failedTasks += 1;
        profile.reputation = newRep;
        profile.lastUpdated = uint32(block.timestamp);

        emit TaskRecorded(agent, false, rewardAmount, newRep);

        // Update leaderboard
        _updateLeaderboard(agent);
    }

    // --- Administrative Functions ---

    /**
     * @notice Confers or revokes validator operational privileges.
     * @param validator The address of the validator.
     * @param status True to authorize, false to revoke.
     */
    function setValidator(address validator, bool status) external onlyOwner {
        if (validator == address(0)) {
            revert InvalidAddress();
        }
        isValidator[validator] = status;
        emit ValidatorStatusUpdated(validator, status);
    }

    // --- View Functions ---

    /**
     * @notice Retrieves full packed details of an agent profile.
     * @param agent The address of the agent.
     * @return The packed AgentProfile struct.
     */
    function getAgentProfile(
        address agent
    ) external view override agentExists(agent) returns (AgentProfile memory) {
        return _profiles[agent];
    }

    /**
     * @notice Retrieves the current top 10 agents sorted by reputation score.
     * @return An array of the top 10 agent addresses.
     */
    function getTopAgents() external view override returns (address[] memory) {
        return _leaderboard;
    }

    // --- Internal Helpers ---

    /**
     * @dev Internal helper executing leaderboard sorting and insertion.
     * Operates in gas-efficient insertion sort owing to LEADERBOARD_LIMIT = 10.
     */
    function _updateLeaderboard(address agent) internal {
        uint256 currentRep = _profiles[agent].reputation;

        // 1. Check if agent is already on the leaderboard
        int256 agentIndex = -1;
        for (uint256 i = 0; i < _leaderboard.length; i++) {
            if (_leaderboard[i] == agent) {
                agentIndex = int256(i);
                break;
            }
        }

        // 2. Remove agent temporarily from list if already present to allow correct re-insertion
        if (agentIndex >= 0) {
            for (uint256 i = uint256(agentIndex); i < _leaderboard.length - 1; i++) {
                _leaderboard[i] = _leaderboard[i + 1];
            }
            _leaderboard.pop();
        }

        // 3. Find correct insertion position
        uint256 insertPos = _leaderboard.length;
        for (uint256 i = 0; i < _leaderboard.length; i++) {
            if (currentRep > _profiles[_leaderboard[i]].reputation) {
                insertPos = i;
                break;
            }
        }

        // 4. Insert agent if they fit in top 10
        if (insertPos < LEADERBOARD_LIMIT) {
            // Push an empty item to expand length
            _leaderboard.push(address(0));
            // Shift items to the right
            for (uint256 i = _leaderboard.length - 1; i > insertPos; i--) {
                _leaderboard[i] = _leaderboard[i - 1];
            }
            // Put in place
            _leaderboard[insertPos] = agent;

            // Enforce leaderboard ceiling size
            if (_leaderboard.length > LEADERBOARD_LIMIT) {
                _leaderboard.pop();
            }
        }

        emit LeaderboardUpdated(_leaderboard);
    }
}
