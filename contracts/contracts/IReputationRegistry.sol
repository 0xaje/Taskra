// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IReputationRegistry
 * @notice Interface governing Taskra's Agent Reputation Registry, anti-manipulation checks,
 * weighted reputation scoring, and leaderboard tracking on Somnia EVM.
 */
interface IReputationRegistry {

    struct AgentProfile {
        uint32 successfulTasks;
        uint32 failedTasks;
        uint16 reputation; // scale 0-1000 (0.0% to 100.0%)
        uint32 lastUpdated;
        uint128 totalEarnings; // in wei
        bool isInitialized;
    }

    // --- Events ---
    
    event AgentInitialized(address indexed agent, uint16 reputation);
    
    event ReputationUpdated(
        address indexed agent,
        uint16 oldReputation,
        uint16 newReputation,
        address indexed validator,
        string reason
    );
    
    event TaskRecorded(
        address indexed agent,
        bool indexed success,
        uint256 rewardAmount,
        uint16 newReputation
    );
    
    event ValidatorStatusUpdated(address indexed validator, bool indexed isValidator);
    event LeaderboardUpdated(address[] topAgents);

    // --- Custom Errors ---
    
    error AgentNotInitialized();
    error AgentAlreadyInitialized();
    error UnauthorizedValidator();
    error InvalidReputationValue();
    error CooldownActive();
    error InvalidAddress();
    error WeightExceedsLimit();

    // --- Functions ---

    /**
     * @notice Registers and initializes an AI agent's profile with baseline reputation.
     * @param agent The address of the agent node to initialize.
     */
    function initializeAgent(address agent) external;

    /**
     * @notice Manually increases an agent's reputation under weighted and authorized validator conditions.
     * @param agent The address of the agent.
     * @param amount The value to increase the reputation by.
     * @param reason A descriptive explanation of the reward action.
     */
    function increaseReputation(
        address agent,
        uint16 amount,
        string calldata reason
    ) external;

    /**
     * @notice Manually decreases an agent's reputation under weighted and authorized validator conditions.
     * @param agent The address of the agent.
     * @param amount The value to decrease the reputation by.
     * @param reason A descriptive explanation of the penalty action.
     */
    function decreaseReputation(
        address agent,
        uint16 amount,
        string calldata reason
    ) external;

    /**
     * @notice Automates success scoring for completed tasks, calculating earnings and weighted reputation gains.
     * @param agent The address of the agent.
     * @param rewardAmount The size of the task payout in native wei.
     */
    function recordTaskSuccess(address agent, uint256 rewardAmount) external;

    /**
     * @notice Automates penalty scoring for failed tasks, adjusting metrics and applying weighted reputation losses.
     * @param agent The address of the agent.
     * @param rewardAmount The size of the task reward that was lost/slashed in native wei.
     */
    function recordTaskFailure(address agent, uint256 rewardAmount) external;

    /**
     * @notice Retrieves full packed details of an agent profile.
     * @param agent The address of the agent.
     * @return The packed AgentProfile struct.
     */
    function getAgentProfile(address agent) external view returns (AgentProfile memory);

    /**
     * @notice Retrieves the current top 10 agents sorted by reputation score.
     * @return An array of the top 10 agent addresses.
     */
    function getTopAgents() external view returns (address[] memory);
}
