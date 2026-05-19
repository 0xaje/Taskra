// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ITaskraEscrow
 * @notice Interface governing Taskra's secure marketplace escrows, locks, settlements, and dispute resolutions.
 */
interface ITaskraEscrow {
    
    enum EscrowStatus { ACTIVE, RELEASED, SLASHED, REFUNDED }

    struct Escrow {
        bytes32 taskId;
        address payable depositor;
        address payable agent;
        uint256 amount;
        uint256 slashedAmount;
        EscrowStatus status;
        bool exists;
    }

    // --- Events ---
    
    event EscrowCreated(
        bytes32 indexed taskId,
        address indexed depositor,
        address indexed agent,
        uint256 amount
    );
    
    event EscrowReleased(
        bytes32 indexed taskId,
        address indexed agent,
        uint256 amount
    );
    
    event EscrowSlashed(
        bytes32 indexed taskId,
        address indexed agent,
        uint256 slashedAmount,
        address indexed refundRecipient
    );
    
    event EscrowRefunded(
        bytes32 indexed taskId,
        address indexed depositor,
        uint256 amount
    );
    
    event ArbitratorUpdated(
        address indexed previousArbitrator,
        address indexed newArbitrator
    );

    event TreasuryUpdated(
        address indexed previousTreasury,
        address indexed newTreasury
    );

    // --- Custom Errors ---
    
    error EscrowAlreadyExists();
    error EscrowDoesNotExist();
    error EscrowNotActive();
    error InvalidAmount();
    error InvalidAddress();
    error Unauthorized();
    error TransferFailed();
    error SlashAmountExceedsDeposit();

    // --- Functions ---

    /**
     * @notice Locks native Somnia reward tokens in escrow for a designated task and agent.
     * @param taskId The unique identifier of the task.
     * @param agent The address of the AI agent assigned to complete the task.
     */
    function createEscrow(bytes32 taskId, address payable agent) external payable;

    /**
     * @notice Releases the full locked escrow amount to the assigned agent.
     * @dev Callable by the depositor (task creator) or the authorized arbitrator.
     * @param taskId The unique identifier of the task.
     */
    function releasePayment(bytes32 taskId) external;

    /**
     * @notice Slashes a malicious agent's reward, sending the slashed portion to a recipient (creator/treasury).
     * @dev Callable only by the authorized arbitrator.
     * @param taskId The unique identifier of the task.
     * @param slashAmount The absolute amount of native tokens to slash from the escrow.
     * @param refundRecipient The address receiving the slashed native tokens (usually task creator/treasury).
     */
    function slashAgent(
        bytes32 taskId,
        uint256 slashAmount,
        address payable refundRecipient
    ) external;

    /**
     * @notice Cancels an active escrow and refunds all locked tokens to the task depositor.
     * @dev Callable by the arbitrator or the depositor (if the task hasn't been completed).
     * @param taskId The unique identifier of the task.
     */
    function refundEscrow(bytes32 taskId) external;

    /**
     * @notice Retrieves full structural details of a specific escrow lock.
     * @param taskId The unique identifier of the task.
     * @return An Escrow struct containing details of the escrow.
     */
    function getEscrow(bytes32 taskId) external view returns (Escrow memory);
}
