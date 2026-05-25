// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ITaskFactory
 * @notice Interface governing Taskra's TaskFactory autonomous task life cycles, escrows, and agent assignments on Somnia EVM.
 */
interface ITaskFactory {
    
    enum Status {
        OPEN,
        ASSIGNED,
        IN_PROGRESS,
        COMPLETED,
        SETTLED,
        CANCELLED,
        DISPUTED
    }

    struct Task {
        bytes32 id;
        address creator;
        string metadataURI;
        uint256 rewardAmount;
        address assignedAgent;
        Status status;
        uint256 createdAt;
        uint256 completedAt;
        bytes32 proofHash; // cryptographic proof of completion workload
        uint256 disputeDeadline;
    }

    // --- Events ---
    event TaskCreated(bytes32 indexed id, address indexed creator, string metadataURI, uint256 rewardAmount, uint256 createdAt);
    event TaskAssigned(bytes32 indexed id, address indexed assignedAgent, uint256 timestamp);
    event TaskStarted(bytes32 indexed id, uint256 timestamp);
    event TaskCompleted(bytes32 indexed id, uint256 timestamp);
    event TaskCompletedWithProof(bytes32 indexed id, address indexed assignedAgent, bytes32 proofHash, uint256 timestamp);
    event TaskSettled(bytes32 indexed id, address indexed assignedAgent, uint256 rewardAmount, uint256 timestamp);
    event TaskCancelled(bytes32 indexed id, address indexed creator, uint256 refundedAmount, uint256 timestamp);
    event ValidatorVoted(bytes32 indexed id, address indexed validator, bool isValid, uint256 timestamp);
    event TaskDisputed(bytes32 indexed id, address indexed raisedBy, string reason, uint256 timestamp);
    event TaskSlashed(bytes32 indexed id, address indexed assignedAgent, uint256 slashedAmount, uint256 timestamp);
    event EscrowArbitrated(bytes32 indexed id, address indexed arbiter, bool paidAgent, uint256 timestamp);

    // --- Custom Errors ---
    error TaskAlreadyExists();
    error TaskDoesNotExist();
    error TaskNotOpen();
    error TaskNotAssigned();
    error TaskNotInProgress();
    error TaskNotCompleted();
    error Unauthorized();
    error InvalidAddress();
    error EscrowTransferFailed();
    error RewardAmountRequired();
    error CannotCancelActiveTask();
    error ConsensusFailed();
    error DisputePeriodExpired();
    error DisputePeriodActive();
    error DoubleVoting();

    // --- Functions ---
    function createTask(string calldata metadataURI) external payable returns (bytes32);
    function assignTask(bytes32 taskId, address agent) external;
    function markInProgress(bytes32 taskId) external;
    function completeTask(bytes32 taskId) external;
    function completeTaskWithProof(bytes32 taskId, bytes32 proofHash) external;
    
    // On-chain Validator Voting & Dispute coordination
    function voteValidation(bytes32 taskId, bool isValid) external;
    function raiseDispute(bytes32 taskId, string calldata reason) external;
    function arbitrateEscrow(bytes32 taskId, bool payAgent) external;

    function settleTask(bytes32 taskId) external;
    function cancelTask(bytes32 taskId) external;
    
    function getTask(bytes32 taskId) external view returns (Task memory);
}
