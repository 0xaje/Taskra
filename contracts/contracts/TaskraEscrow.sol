// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./ITaskraEscrow.sol";

/**
 * @title TaskraEscrow
 * @notice Production-grade Escrow smart contract for locking rewards, releasing payments,
 * partial slashing of malicious agents, and resolving disputable task outcomes on Somnia EVM.
 * @dev Inherits OpenZeppelin's Ownable, ReentrancyGuard, and Pausable for robust access controls, reentrancy mitigation, and emergency pausing.
 */
contract TaskraEscrow is ITaskraEscrow, Ownable, ReentrancyGuard, Pausable {

    // --- State Variables ---

    /// @notice The designated dispute resolution arbitrator.
    address public arbitrator;

    /// @notice The platform fee/penalty collection treasury.
    address payable public treasury;

    /// @notice Total native tokens ever deposited into escrows.
    uint256 public totalDeposited;

    /// @notice Total native tokens released to agents.
    uint256 public totalReleased;

    /// @notice Total native tokens slashed from malicious agents.
    uint256 public totalSlashed;

    /// @notice Total native tokens refunded to depositors.
    uint256 public totalRefunded;

    /// @dev Internal mapping of escrows indexed by their unique taskId.
    mapping(bytes32 => Escrow) private _escrows;

    // --- Modifiers ---

    /**
     * @dev Validates that the escrow for the taskId exists.
     */
    modifier escrowExists(bytes32 taskId) {
        if (!_escrows[taskId].exists) {
            revert EscrowDoesNotExist();
        }
        _;
    }

    /**
     * @dev Validates that the escrow is in ACTIVE status.
     */
    modifier escrowActive(bytes32 taskId) {
        if (_escrows[taskId].status != EscrowStatus.ACTIVE) {
            revert EscrowNotActive();
        }
        _;
    }

    /**
     * @dev Restricts execution only to the authorized arbitrator or the owner.
     */
    modifier onlyArbitrator() {
        if (msg.sender != arbitrator && msg.sender != owner()) {
            revert Unauthorized();
        }
        _;
    }

    /**
     * @dev Restricts execution only to the task depositor or authorized arbitrator.
     */
    modifier onlyDepositorOrArbitrator(bytes32 taskId) {
        Escrow storage escrow = _escrows[taskId];
        if (msg.sender != escrow.depositor && msg.sender != arbitrator && msg.sender != owner()) {
            revert Unauthorized();
        }
        _;
    }

    // --- Constructor ---

    /**
     * @notice Initializes the TaskraEscrow contract.
     * @param initialOwner The address of the initial administrator/owner of the escrow contract.
     * @param initialArbitrator The address of the designated arbitrator/dispute-resolution module.
     * @param initialTreasury The address of the platform fee and slashes treasury.
     */
    constructor(
        address initialOwner,
        address initialArbitrator,
        address payable initialTreasury
    ) Ownable(initialOwner) ReentrancyGuard() {
        if (initialOwner == address(0) || initialArbitrator == address(0) || initialTreasury == address(0)) {
            revert InvalidAddress();
        }
        arbitrator = initialArbitrator;
        treasury = initialTreasury;

        emit ArbitratorUpdated(address(0), initialArbitrator);
        emit TreasuryUpdated(address(0), initialTreasury);
    }

    // --- External Functions ---

    /**
     * @notice Locks native Somnia reward tokens in escrow for a designated task and agent.
     * @dev The sender must send native value along with the call to fund the escrow lock.
     * @param taskId The unique identifier of the task.
     * @param agent The address of the AI agent assigned to complete the task.
     */
    function createEscrow(
        bytes32 taskId,
        address payable agent
    ) external payable override nonReentrant whenNotPaused {
        if (msg.value == 0) {
            revert InvalidAmount();
        }
        if (agent == address(0)) {
            revert InvalidAddress();
        }
        if (_escrows[taskId].exists) {
            revert EscrowAlreadyExists();
        }

        // Initialize Escrow record
        _escrows[taskId] = Escrow({
            taskId: taskId,
            depositor: payable(msg.sender),
            agent: agent,
            amount: msg.value,
            slashedAmount: 0,
            status: EscrowStatus.ACTIVE,
            exists: true
        });

        // Update global accounting
        totalDeposited += msg.value;

        emit EscrowCreated(taskId, msg.sender, agent, msg.value);
    }

    /**
     * @notice Releases the full locked escrow amount to the assigned agent.
     * @dev Callable by the depositor (satisfied creator) or the authorized arbitrator.
     * Uses Checks-Effects-Interactions and nonReentrant to secure native transfers.
     * @param taskId The unique identifier of the task.
     */
    function releasePayment(
        bytes32 taskId
    ) external override whenNotPaused escrowExists(taskId) escrowActive(taskId) onlyDepositorOrArbitrator(taskId) nonReentrant {
        Escrow storage escrow = _escrows[taskId];
        uint256 payout = escrow.amount;
        address payable agent = escrow.agent;

        // Effect
        escrow.status = EscrowStatus.RELEASED;
        totalReleased += payout;

        // Interaction
        (bool success, ) = agent.call{value: payout}("");
        if (!success) {
            revert TransferFailed();
        }

        emit EscrowReleased(taskId, agent, payout);
    }

    /**
     * @notice Slashes a malicious agent's reward, sending the slashed portion to the creator or treasury.
     * @dev Callable only by the arbitrator or owner.
     * Performs a partial slash: the slashed amount is sent to the refundRecipient (depositor/treasury)
     * and any remaining balance is released to the agent as partial payout.
     * Uses nonReentrant and Checks-Effects-Interactions.
     * @param taskId The unique identifier of the task.
     * @param slashAmount The absolute amount of native tokens to slash from the escrow lock.
     * @param refundRecipient The address receiving the slashed native tokens (e.g. task creator or platform).
     */
    function slashAgent(
        bytes32 taskId,
        uint256 slashAmount,
        address payable refundRecipient
    ) external override whenNotPaused escrowExists(taskId) escrowActive(taskId) onlyArbitrator nonReentrant {
        if (refundRecipient == address(0)) {
            revert InvalidAddress();
        }
        
        Escrow storage escrow = _escrows[taskId];
        uint256 totalEscrow = escrow.amount;

        if (slashAmount > totalEscrow) {
            revert SlashAmountExceedsDeposit();
        }

        uint256 remainingPayout = totalEscrow - slashAmount;
        address payable agent = escrow.agent;

        // Effect
        escrow.status = EscrowStatus.SLASHED;
        escrow.slashedAmount = slashAmount;
        
        totalSlashed += slashAmount;
        totalReleased += remainingPayout;

        // Interaction - Slashed amount to recipient
        if (slashAmount > 0) {
            (bool successSlash, ) = refundRecipient.call{value: slashAmount}("");
            if (!successSlash) {
                revert TransferFailed();
            }
        }

        // Interaction - Remainder to agent
        if (remainingPayout > 0) {
            (bool successAgent, ) = agent.call{value: remainingPayout}("");
            if (!successAgent) {
                revert TransferFailed();
            }
        }

        emit EscrowSlashed(taskId, agent, slashAmount, refundRecipient);
    }

    /**
     * @notice Cancels an active escrow and refunds all locked tokens to the task depositor.
     * @dev Callable by the arbitrator/owner at any time, or the depositor.
     * Uses nonReentrant and Checks-Effects-Interactions.
     * @param taskId The unique identifier of the task.
     */
    function refundEscrow(
        bytes32 taskId
    ) external override whenNotPaused escrowExists(taskId) escrowActive(taskId) onlyDepositorOrArbitrator(taskId) nonReentrant {
        Escrow storage escrow = _escrows[taskId];
        uint256 refundAmount = escrow.amount;
        address payable depositor = escrow.depositor;

        // Effect
        escrow.status = EscrowStatus.REFUNDED;
        totalRefunded += refundAmount;

        // Interaction
        (bool success, ) = depositor.call{value: refundAmount}("");
        if (!success) {
            revert TransferFailed();
        }

        emit EscrowRefunded(taskId, depositor, refundAmount);
    }

    // --- Administrative Functions ---

    /**
     * @notice Pauses the contract in case of an emergency, preventing state-modifying actions.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses the contract, resuming normal operations.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Configures the designated arbitrator for contract dispute resolutions.
     * @param newArbitrator Address of the new arbitrator module/multisig.
     */
    function setArbitrator(address newArbitrator) external onlyOwner {
        if (newArbitrator == address(0)) {
            revert InvalidAddress();
        }
        address previous = arbitrator;
        arbitrator = newArbitrator;

        emit ArbitratorUpdated(previous, newArbitrator);
    }

    /**
     * @notice Configures the treasury address receiving platform fees or slashes.
     * @param newTreasury Payable address of the platform treasury.
     */
    function setTreasury(address payable newTreasury) external onlyOwner {
        if (newTreasury == address(0)) {
            revert InvalidAddress();
        }
        address previous = treasury;
        treasury = newTreasury;

        emit TreasuryUpdated(previous, newTreasury);
    }

    // --- View Functions ---

    /**
     * @notice Retrieves full structural details of a specific escrow lock.
     * @param taskId The unique identifier of the task.
     * @return An Escrow struct containing details of the escrow.
     */
    function getEscrow(
        bytes32 taskId
    ) external view override escrowExists(taskId) returns (Escrow memory) {
        return _escrows[taskId];
    }
}
