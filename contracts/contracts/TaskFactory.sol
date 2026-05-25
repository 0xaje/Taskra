// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ITaskFactory.sol";
import "./AgentRegistry.sol";
import "./ReputationRegistry.sol";

/**
 * @title TaskFactory
 * @notice Production-grade implementation of ITaskFactory for Somnia EVM.
 * @dev Manages the creation, assignment, progression, completion, validator voting consensus, disputes, slashing, and autonomous settlements.
 */
contract TaskFactory is ITaskFactory, Ownable, ReentrancyGuard {
    
    // --- State Variables ---
    
    /// @notice The total number of tasks created through this factory.
    uint256 public taskCount;

    /// @notice Address of the AgentRegistry contract.
    AgentRegistry public agentRegistry;

    /// @notice Address of the ReputationRegistry contract.
    ReputationRegistry public reputationRegistry;

    /// @dev Internal mapping containing task details keyed by their generated taskId.
    mapping(bytes32 => Task) private _tasks;

    /// @dev Internal list of all task IDs for enumeration.
    bytes32[] private _allTaskIds;

    /// @dev Mapping to track validator votes on a specific taskId (taskId => validator => hasVoted).
    mapping(bytes32 => mapping(address => bool)) public hasVoted;

    /// @dev Votes tracking for tasks (taskId => votesFor).
    mapping(bytes32 => uint256) public taskVotesFor;

    /// @dev Votes tracking for tasks (taskId => votesAgainst).
    mapping(bytes32 => uint256) public taskVotesAgainst;

    /// @dev Validators count who voted on taskId
    mapping(bytes32 => uint256) public totalVotedCount;

    // --- Modifiers ---

    modifier onlyValidator() {
        if (!reputationRegistry.isValidator(msg.sender) && msg.sender != owner()) {
            revert Unauthorized();
        }
        _;
    }

    modifier taskExists(bytes32 taskId) {
        if (_tasks[taskId].creator == address(0)) {
            revert TaskDoesNotExist();
        }
        _;
    }

    modifier onlyCreator(bytes32 taskId) {
        if (_tasks[taskId].creator == address(0)) {
            revert TaskDoesNotExist();
        }
        if (_tasks[taskId].creator != msg.sender) {
            revert Unauthorized();
        }
        _;
    }

    modifier onlyAssignedAgent(bytes32 taskId) {
        if (_tasks[taskId].creator == address(0)) {
            revert TaskDoesNotExist();
        }
        if (_tasks[taskId].assignedAgent != msg.sender) {
            revert Unauthorized();
        }
        _;
    }

    // --- Constructor ---

    constructor(
        address initialOwner,
        address _agentRegistry,
        address _reputationRegistry
    ) Ownable(initialOwner) ReentrancyGuard() {
        if (initialOwner == address(0) || _agentRegistry == address(0) || _reputationRegistry == address(0)) {
            revert InvalidAddress();
        }
        agentRegistry = AgentRegistry(_agentRegistry);
        reputationRegistry = ReputationRegistry(_reputationRegistry);
    }

    // --- External Functions ---

    function createTask(string calldata metadataURI) external payable override returns (bytes32) {
        if (msg.value == 0) {
            revert RewardAmountRequired();
        }
        if (bytes(metadataURI).length == 0) {
            revert InvalidAddress();
        }

        uint256 currentCount = ++taskCount;

        bytes32 taskId = keccak256(
            abi.encodePacked(
                msg.sender,
                currentCount,
                block.timestamp,
                block.chainid
            )
        );

        if (_tasks[taskId].creator != address(0)) {
            revert TaskAlreadyExists();
        }

        _tasks[taskId] = Task({
            id: taskId,
            creator: msg.sender,
            metadataURI: metadataURI,
            rewardAmount: msg.value,
            assignedAgent: address(0),
            status: Status.OPEN,
            createdAt: block.timestamp,
            completedAt: 0,
            proofHash: bytes32(0),
            disputeDeadline: 0
        });

        _allTaskIds.push(taskId);

        emit TaskCreated(taskId, msg.sender, metadataURI, msg.value, block.timestamp);

        return taskId;
    }

    function assignTask(bytes32 taskId, address agent) external override onlyCreator(taskId) {
        if (agent == address(0)) {
            revert InvalidAddress();
        }

        Task storage task = _tasks[taskId];
        if (task.status != Status.OPEN) {
            revert TaskNotOpen();
        }

        task.assignedAgent = agent;
        task.status = Status.ASSIGNED;

        emit TaskAssigned(taskId, agent, block.timestamp);
    }

    function markInProgress(bytes32 taskId) external override onlyAssignedAgent(taskId) {
        Task storage task = _tasks[taskId];
        if (task.status != Status.ASSIGNED) {
            revert TaskNotAssigned();
        }

        task.status = Status.IN_PROGRESS;

        emit TaskStarted(taskId, block.timestamp);
    }

    function completeTask(bytes32 taskId) external override onlyAssignedAgent(taskId) {
        Task storage task = _tasks[taskId];
        if (task.status != Status.IN_PROGRESS) {
            revert TaskNotInProgress();
        }

        task.status = Status.COMPLETED;
        task.completedAt = block.timestamp;
        task.disputeDeadline = block.timestamp + 1 hours; // 1-hour dispute window

        emit TaskCompleted(taskId, block.timestamp);
    }

    function completeTaskWithProof(bytes32 taskId, bytes32 proofHash) external override onlyAssignedAgent(taskId) {
        if (proofHash == bytes32(0)) {
            revert InvalidAddress();
        }
        
        Task storage task = _tasks[taskId];
        if (task.status != Status.IN_PROGRESS) {
            revert TaskNotInProgress();
        }

        task.status = Status.COMPLETED;
        task.completedAt = block.timestamp;
        task.proofHash = proofHash;
        task.disputeDeadline = block.timestamp + 1 hours; // 1-hour dispute window

        emit TaskCompletedWithProof(taskId, msg.sender, proofHash, block.timestamp);
    }

    // --- On-chain Validator Voting & Dispute Resolution ---

    function voteValidation(bytes32 taskId, bool isValid) external override onlyValidator taskExists(taskId) nonReentrant {
        Task storage task = _tasks[taskId];
        if (task.status != Status.COMPLETED && task.status != Status.DISPUTED) {
            revert TaskNotCompleted();
        }

        if (hasVoted[taskId][msg.sender]) {
            revert DoubleVoting();
        }

        hasVoted[taskId][msg.sender] = true;
        totalVotedCount[taskId] += 1;

        if (isValid) {
            taskVotesFor[taskId] += 1;
        } else {
            taskVotesAgainst[taskId] += 1;
        }

        emit ValidatorVoted(taskId, msg.sender, isValid, block.timestamp);

        // Consensus rule: If at least 2 validator votes are cast, we resolve autonomously
        if (totalVotedCount[taskId] >= 2) {
            _resolveConsensus(taskId);
        }
    }

    function raiseDispute(bytes32 taskId, string calldata reason) external override taskExists(taskId) {
        Task storage task = _tasks[taskId];
        
        // Either the creator can raise a dispute, or an authorized validator can
        if (msg.sender != task.creator && !reputationRegistry.isValidator(msg.sender)) {
            revert Unauthorized();
        }

        if (task.status != Status.COMPLETED) {
            revert TaskNotCompleted();
        }

        if (block.timestamp > task.disputeDeadline) {
            revert DisputePeriodExpired();
        }

        task.status = Status.DISPUTED;
        emit TaskDisputed(taskId, msg.sender, reason, block.timestamp);
    }

    function arbitrateEscrow(bytes32 taskId, bool payAgent) external override onlyOwner taskExists(taskId) nonReentrant {
        Task storage task = _tasks[taskId];
        if (task.status != Status.DISPUTED) {
            revert Unauthorized(); // Must be in DISPUTED state to arbitrate
        }

        address agent = task.assignedAgent;
        uint256 payout = task.rewardAmount;

        if (payAgent) {
            task.status = Status.SETTLED;
            (bool success, ) = payable(agent).call{value: payout}("");
            if (!success) revert EscrowTransferFailed();
            
            reputationRegistry.recordTaskSuccess(agent, payout);
            emit TaskSettled(taskId, agent, payout, block.timestamp);
        } else {
            task.status = Status.CANCELLED;
            (bool success, ) = payable(task.creator).call{value: payout}("");
            if (!success) revert EscrowTransferFailed();

            // Slash agent collateral if it is registered
            try agentRegistry.slashAgent(agent, 0.05 ether) {} catch {}
            reputationRegistry.recordTaskFailure(agent, payout);
            
            emit TaskSlashed(taskId, agent, 0.05 ether, block.timestamp);
            emit TaskCancelled(taskId, task.creator, payout, block.timestamp);
        }

        emit EscrowArbitrated(taskId, msg.sender, payAgent, block.timestamp);
    }

    function _resolveConsensus(bytes32 taskId) internal {
        Task storage task = _tasks[taskId];
        address agent = task.assignedAgent;
        uint256 payout = task.rewardAmount;

        uint256 votesFor = taskVotesFor[taskId];
        uint256 votesAgainst = taskVotesAgainst[taskId];

        if (votesFor > votesAgainst) {
            // Consensus: Valid
            task.status = Status.SETTLED;
            (bool success, ) = payable(agent).call{value: payout}("");
            if (!success) revert EscrowTransferFailed();

            reputationRegistry.recordTaskSuccess(agent, payout);
            emit TaskSettled(taskId, agent, payout, block.timestamp);
        } else {
            // Consensus: Invalid
            task.status = Status.CANCELLED;
            (bool success, ) = payable(task.creator).call{value: payout}("");
            if (!success) revert EscrowTransferFailed();

            // Slash agent's collateral on registry
            try agentRegistry.slashAgent(agent, 0.05 ether) {} catch {}
            reputationRegistry.recordTaskFailure(agent, payout);

            emit TaskSlashed(taskId, agent, 0.05 ether, block.timestamp);
            emit TaskCancelled(taskId, task.creator, payout, block.timestamp);
        }
    }

    function settleTask(bytes32 taskId) external override onlyCreator(taskId) nonReentrant {
        Task storage task = _tasks[taskId];
        if (task.status != Status.COMPLETED) {
            revert TaskNotCompleted();
        }

        if (block.timestamp < task.disputeDeadline) {
            revert DisputePeriodActive();
        }

        address agent = task.assignedAgent;
        uint256 payout = task.rewardAmount;

        task.status = Status.SETTLED;

        (bool success, ) = payable(agent).call{value: payout}("");
        if (!success) revert EscrowTransferFailed();

        reputationRegistry.recordTaskSuccess(agent, payout);
        emit TaskSettled(taskId, agent, payout, block.timestamp);
    }

    function cancelTask(bytes32 taskId) external override onlyCreator(taskId) nonReentrant {
        Task storage task = _tasks[taskId];
        Status currentStatus = task.status;

        if (currentStatus == Status.IN_PROGRESS || currentStatus == Status.COMPLETED || currentStatus == Status.DISPUTED) {
            revert CannotCancelActiveTask();
        }

        if (currentStatus != Status.OPEN && currentStatus != Status.ASSIGNED) {
            revert TaskNotOpen();
        }

        uint256 refund = task.rewardAmount;
        address creator = task.creator;

        task.status = Status.CANCELLED;

        (bool success, ) = payable(creator).call{value: refund}("");
        if (!success) revert EscrowTransferFailed();

        emit TaskCancelled(taskId, creator, refund, block.timestamp);
    }

    function getTask(bytes32 taskId) external view override taskExists(taskId) returns (Task memory) {
        return _tasks[taskId];
    }

    function getAllTaskIds() external view returns (bytes32[] memory) {
        return _allTaskIds;
    }

    function recoverERC20(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            revert InvalidAddress();
        }
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSignature("transfer(address,uint256)", owner(), amount)
        );
        if (!success || (data.length > 0 && !abi.decode(data, (bool)))) {
            revert EscrowTransferFailed();
        }
    }
}
