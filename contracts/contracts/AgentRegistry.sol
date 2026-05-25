// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AgentRegistry
 * @notice Manages registration, collateral staking, slashing, and controllers of AI agents on Somnia L1/L2
 */
contract AgentRegistry is Ownable, ReentrancyGuard {
    enum AgentTier { Standard, Advanced, Elite }
    enum AgentStatus { ACTIVE_BIDDING, IDLE_SCANNING, OFFLINE, BANKRUPT, COOLDOWN }

    struct AgentNode {
        string name;
        string specialty;
        AgentTier tier;
        uint256 reputation; // scale 0-1000 (representing 0.0 - 100.0)
        uint256 stake;
        AgentStatus status;
        address owner;
        bool isRegistered;
    }

    // --- State Variables ---
    mapping(address => AgentNode) public agents;
    address[] public registeredAddresses;
    mapping(address => bool) public isController;

    // --- Events ---
    event AgentRegistered(address indexed agentAddress, string name, AgentTier tier, uint256 stakedAmount);
    event ReputationUpdated(address indexed agentAddress, uint256 newReputation);
    event StatusChanged(address indexed agentAddress, AgentStatus newStatus);
    event StakeRefunded(address indexed agentAddress, uint256 amountRefunded);
    event StakeSlashed(address indexed agentAddress, uint256 amountSlashed, address indexed controller);
    event StakeToppedUp(address indexed agentAddress, uint256 topUpAmount, uint256 newTotalStake);
    event ControllerStatusUpdated(address indexed controller, bool status);

    // --- Custom Errors ---
    error AgentAlreadyExists();
    error AgentDoesNotExist();
    error InsufficientStake();
    error UnauthorizedController();
    error InvalidAddress();
    error TransferFailed();

    // --- Modifiers ---
    modifier onlyController() {
        if (!isController[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedController();
        }
        _;
    }

    modifier agentExists(address agent) {
        if (!agents[agent].isRegistered) {
            revert AgentDoesNotExist();
        }
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) ReentrancyGuard() {
        if (initialOwner == address(0)) {
            revert InvalidAddress();
        }
    }

    function setController(address controller, bool status) external onlyOwner {
        if (controller == address(0)) {
            revert InvalidAddress();
        }
        isController[controller] = status;
        emit ControllerStatusUpdated(controller, status);
    }

    function registerAgent(
        string calldata _name,
        string calldata _specialty,
        AgentTier _tier
    ) external payable nonReentrant {
        if (agents[msg.sender].isRegistered) revert AgentAlreadyExists();

        uint256 minStake = 0.05 ether;
        if (_tier == AgentTier.Advanced) {
            minStake = 0.15 ether;
        } else if (_tier == AgentTier.Elite) {
            minStake = 0.50 ether;
        }

        if (msg.value < minStake) revert InsufficientStake();

        agents[msg.sender] = AgentNode({
            name: _name,
            specialty: _specialty,
            tier: _tier,
            reputation: 750, // default baseline: 75.0%
            stake: msg.value,
            status: AgentStatus.IDLE_SCANNING,
            owner: msg.sender,
            isRegistered: true
        });

        registeredAddresses.push(msg.sender);

        emit AgentRegistered(msg.sender, _name, _tier, msg.value);
    }

    function topUpStake() external payable agentExists(msg.sender) nonReentrant {
        if (msg.value == 0) revert InsufficientStake();
        
        AgentNode storage agent = agents[msg.sender];
        agent.stake += msg.value;
        
        emit StakeToppedUp(msg.sender, msg.value, agent.stake);
    }

    function updateReputation(address _agent, uint256 _newRep) external onlyController agentExists(_agent) {
        require(_newRep <= 1000, "Reputation cannot exceed 100%");
        agents[_agent].reputation = _newRep;
        emit ReputationUpdated(_agent, _newRep);
    }

    function setStatus(AgentStatus _status) external agentExists(msg.sender) {
        agents[msg.sender].status = _status;
        emit StatusChanged(msg.sender, _status);
    }

    function slashAgent(address _agent, uint256 _amount) external onlyController agentExists(_agent) nonReentrant {
        AgentNode storage agent = agents[_agent];
        uint256 slashAmount = _amount;
        
        if (slashAmount > agent.stake) {
            slashAmount = agent.stake;
        }
        
        agent.stake -= slashAmount;
        
        if (agent.stake == 0) {
            agent.status = AgentStatus.BANKRUPT;
        }

        // Send slashed funds to owner/treasury
        (bool success, ) = payable(owner()).call{value: slashAmount}("");
        if (!success) revert TransferFailed();
        
        emit StakeSlashed(_agent, slashAmount, msg.sender);
    }

    function decommissionAgent() external agentExists(msg.sender) nonReentrant {
        AgentNode storage agent = agents[msg.sender];
        uint256 refundAmount = agent.stake / 2; // refund 50% penalty as per specification
        
        delete agents[msg.sender];
        
        // Remove from registered addresses array
        for (uint256 i = 0; i < registeredAddresses.length; i++) {
            if (registeredAddresses[i] == msg.sender) {
                registeredAddresses[i] = registeredAddresses[registeredAddresses.length - 1];
                registeredAddresses.pop();
                break;
            }
        }

        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        if (!success) revert TransferFailed();
        
        emit StakeRefunded(msg.sender, refundAmount);
    }

    function getAgent(address _agent) external view agentExists(_agent) returns (AgentNode memory) {
        return agents[_agent];
    }
}
