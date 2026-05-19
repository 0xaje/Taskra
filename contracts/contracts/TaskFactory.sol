// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ITaskFactory.sol";

/**
 * @title TaskFactory
 * @notice Production-grade implementation of ITaskFactory for Somnia EVM.
 * @dev Manages the creation, assignment, progression, completion, settlement, and cancellation of autonomous tasks.
 * Includes reentrancy protection, access control modifiers, optimized storage, and strict state machine transitions.
 */
contract TaskFactory is ITaskFactory, Ownable, ReentrancyGuard {
    
    // --- State Variables ---
    
    /// @notice The total number of tasks created through this factory.
    uint256 public taskCount;

    /// @dev Internal mapping containing task details keyed by their generated taskId.
    mapping(bytes32 => Task) private _tasks;

    /// @dev Internal list of all task IDs for enumeration.
    bytes32[] private _allTaskIds;

    // --- Modifiers ---

    /**
     * @dev Validates that the task exists (has a non-zero creator address).
     * @param taskId The unique identifier of the task.
     */
    modifier taskExists(bytes32 taskId) {
        if (_tasks[taskId].creator == address(0)) {
            revert TaskDoesNotExist();
        }
        _;
    }

    /**
     * @dev Restricts access only to the creator of the specified task.
     * @param taskId The unique identifier of the task.
     */
    modifier onlyCreator(bytes32 taskId) {
        if (_tasks[taskId].creator == address(0)) {
            revert TaskDoesNotExist();
        }
        if (_tasks[taskId].creator != msg.sender) {
            revert Unauthorized();
        }
        _;
    }

    /**
     * @dev Restricts access only to the assigned agent of the specified task.
     * @param taskId The unique identifier of the task.
     */
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

    /**
     * @notice Initializes the TaskFactory contract.
     * @param initialOwner The address of the initial administrator/owner of the contract.
     */
    constructor(address initialOwner) Ownable(initialOwner) ReentrancyGuard() {
        if (initialOwner == address(0)) {
            revert InvalidAddress();
        }
    }

    // --- External Functions ---

    /**
     * @notice Creates a new autonomous task on Somnia EVM.
     * @dev The caller must send native currency to fund the task reward. Generates a unique task ID.
     * @param metadataURI The decentralized storage URI (IPFS/Arweave) containing task specification metadata.
     * @return taskId The unique 32-byte identifier for the newly created task.
     */
    function createTask(string calldata metadataURI) external payable override returns (bytes32) {
        if (msg.value == 0) {
            revert RewardAmountRequired();
        }
        if (bytes(metadataURI).length == 0) {
            revert InvalidAddress(); // Reusing error or standard validation for empty strings
        }

        // Increment task count to maintain sequential uniqueness
        uint256 currentCount = ++taskCount;

        // Generate a secure and unique task ID
        bytes32 taskId = keccak256(
            abi.encodePacked(
                msg.sender,
                currentCount,
                block.timestamp,
                block.chainid
            )
        );

        // Verify task uniqueness (extremely unlikely to collide, but guard is standard)
        if (_tasks[taskId].creator != address(0)) {
            revert TaskAlreadyExists();
        }

        // Construct task struct
        _tasks[taskId] = Task({
            id: taskId,
            creator: msg.sender,
            metadataURI: metadataURI,
            rewardAmount: msg.value,
            assignedAgent: address(0),
            status: Status.OPEN,
            createdAt: block.timestamp,
            completedAt: 0
        });

        // Store ID in historical list
        _allTaskIds.push(taskId);

        emit TaskCreated(taskId, msg.sender, metadataURI, msg.value, block.timestamp);

        return taskId;
    }

    /**
     * @notice Assigns a registered AI agent to an open task.
     * @dev Only callable by the task creator. The task must be in the OPEN status.
     * @param taskId The unique identifier of the task.
     * @param agent The address of the assigned AI agent.
     */
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

    /**
     * @notice Marks an assigned task as currently IN_PROGRESS by the agent.
     * @dev Only callable by the assigned agent. The task must be in the ASSIGNED status.
     * @param taskId The unique identifier of the task.
     */
    function markInProgress(bytes32 taskId) external override onlyAssignedAgent(taskId) {
        Task storage task = _tasks[taskId];
        if (task.status != Status.ASSIGNED) {
            revert TaskNotAssigned();
        }

        task.status = Status.IN_PROGRESS;

        emit TaskStarted(taskId, block.timestamp);
    }

    /**
     * @notice Signals that the assigned agent has successfully completed the task.
     * @dev Only callable by the assigned agent. The task must be in the IN_PROGRESS status.
     * @param taskId The unique identifier of the task.
     */
    function completeTask(bytes32 taskId) external override onlyAssignedAgent(taskId) {
        Task storage task = _tasks[taskId];
        if (task.status != Status.IN_PROGRESS) {
            revert TaskNotInProgress();
        }

        task.status = Status.COMPLETED;
        task.completedAt = block.timestamp;

        emit TaskCompleted(taskId, block.timestamp);
    }

    /**
     * @notice Settles a completed task, paying out the escrowed reward to the assigned agent.
     * @dev Only callable by the task creator. The task must be in the COMPLETED status.
     * Uses nonReentrant modifier to protect against reentrancy vectors during the native asset transfer.
     * @param taskId The unique identifier of the task.
     */
    function settleTask(bytes32 taskId) external override onlyCreator(taskId) nonReentrant {
        Task storage task = _tasks[taskId];
        if (task.status != Status.COMPLETED) {
            revert TaskNotCompleted();
        }

        address agent = task.assignedAgent;
        uint256 payout = task.rewardAmount;

        // Perform state update BEFORE the external transfer (Checks-Effects-Interactions pattern)
        task.status = Status.SETTLED;

        // Transfer escrowed funds to agent
        (bool success, ) = payable(agent).call{value: payout}("");
        if (!success) {
            revert EscrowTransferFailed();
        }

        emit TaskSettled(taskId, agent, payout, block.timestamp);
    }

    /**
     * @notice Cancels a task and refunds the escrowed reward back to the task creator.
     * @dev Only callable by the task creator. The task must NOT be active (IN_PROGRESS or COMPLETED).
     * Cannot cancel tasks that are already SETTLED or CANCELLED since their statuses are not OPEN or ASSIGNED.
     * Uses nonReentrant modifier to protect against reentrancy vectors during the refund transfer.
     * @param taskId The unique identifier of the task.
     */
    function cancelTask(bytes32 taskId) external override onlyCreator(taskId) nonReentrant {
        Task storage task = _tasks[taskId];
        Status currentStatus = task.status;

        // Check if task is active (IN_PROGRESS or COMPLETED)
        if (currentStatus == Status.IN_PROGRESS || currentStatus == Status.COMPLETED) {
            revert CannotCancelActiveTask();
        }

        // Check if task is not cancellable (must be OPEN or ASSIGNED)
        if (currentStatus != Status.OPEN && currentStatus != Status.ASSIGNED) {
            revert TaskNotOpen(); // Reusing TaskNotOpen to signify task is not in a customizable open state
        }

        uint256 refund = task.rewardAmount;
        address creator = task.creator;

        // Perform state update BEFORE the external transfer (Checks-Effects-Interactions pattern)
        task.status = Status.CANCELLED;

        // Refund escrowed funds to task creator
        (bool success, ) = payable(creator).call{value: refund}("");
        if (!success) {
            revert EscrowTransferFailed();
        }

        emit TaskCancelled(taskId, creator, refund, block.timestamp);
    }

    /**
     * @notice Retrieves the full struct details of a specific task.
     * @param taskId The unique identifier of the task.
     * @return A Task struct containing all current information about the task.
     */
    function getTask(bytes32 taskId) external view override taskExists(taskId) returns (Task memory) {
        return _tasks[taskId];
    }

    /**
     * @notice Retrieves all task IDs created through this factory.
     * @return An array of 32-byte unique task identifiers.
     */
    function getAllTaskIds() external view returns (bytes32[] memory) {
        return _allTaskIds;
    }

    /**
     * @notice Emergency administrative withdrawal of stuck ERC20 tokens.
     * @dev Native funds held in escrows are not withdrawable through this function.
     * @param token Address of the ERC20 token to recover.
     * @param amount Quantity of tokens to withdraw.
     */
    function recoverERC20(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            revert InvalidAddress();
        }
        // Low-level call to avoid direct dependency on IERC20
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSignature("transfer(address,uint256)", owner(), amount)
        );
        if (!success || (data.length > 0 && !abi.decode(data, (bool)))) {
            revert EscrowTransferFailed();
        }
    }
}
