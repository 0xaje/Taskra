// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AgentRegistry.sol";

/**
 * @title TaskraMarketplace
 * @notice Governs escrowed task postings, agent bids, and decentralized settlements on Somnia Blockchain
 */
contract TaskraMarketplace {
    AgentRegistry public registry;

    enum TaskStatus { Open, InProgress, Completed, Cancelled }

    struct Task {
        string title;
        uint256 reward;
        address creator;
        address assignedAgent;
        TaskStatus status;
        string specsHash;
        bool isNative; // true for ETH, false for USDC/ERC20 (simplified here as native ETH escrows)
    }

    struct Bid {
        uint256 bidAmount;
        address biddingAgent;
        bool accepted;
    }

    mapping(bytes32 => Task) public tasks;
    mapping(bytes32 => Bid[]) public bids;

    event TaskCreated(bytes32 indexed taskId, string title, uint256 reward, address indexed creator);
    event BidSubmitted(bytes32 indexed taskId, address indexed agentAddress, uint256 amount);
    event BidAccepted(bytes32 indexed taskId, address indexed agentAddress);
    event TaskSettled(bytes32 indexed taskId, address indexed agentAddress, uint256 rewardPayout);

    error TaskAlreadyExists();
    error TaskNotAvailable();
    error Unauthorized();
    error PayoutFailed();

    constructor(address _registryAddress) {
        registry = AgentRegistry(_registryAddress);
    }

    function createTask(
        bytes32 _taskId,
        string calldata _title,
        string calldata _specsHash
    ) external payable {
        if (tasks[_taskId].creator != address(0)) revert TaskAlreadyExists();
        require(msg.value > 0, "Escrow deposit required");

        tasks[_taskId] = Task({
            title: _title,
            reward: msg.value,
            creator: msg.sender,
            assignedAgent: address(0),
            status: TaskStatus.Open,
            specsHash: _specsHash,
            isNative: true
        });

        emit TaskCreated(_taskId, _title, msg.value, msg.sender);
    }

    function submitBid(bytes32 _taskId) external {
        if (tasks[_taskId].status != TaskStatus.Open) revert TaskNotAvailable();
        
        // Assert agent is registered in the AgentRegistry
        (,,,,, AgentRegistry.AgentStatus status,, bool registered) = registry.agents(msg.sender);
        require(registered, "Agent must be registered to bid");
        require(status == AgentRegistry.AgentStatus.Active, "Agent node must be active");

        bids[_taskId].push(Bid({
            bidAmount: tasks[_taskId].reward,
            biddingAgent: msg.sender,
            accepted: false
        }));

        emit BidSubmitted(_taskId, msg.sender, tasks[_taskId].reward);
    }

    function acceptBid(bytes32 _taskId, address _agent) external {
        Task storage task = tasks[_taskId];
        if (task.creator != msg.sender) revert Unauthorized();
        if (task.status != TaskStatus.Open) revert TaskNotAvailable();

        task.assignedAgent = _agent;
        task.status = TaskStatus.InProgress;

        // Mark agent bid accepted
        Bid[] storage taskBids = bids[_taskId];
        for (uint256 i = 0; i < taskBids.length; i++) {
            if (taskBids[i].biddingAgent == _agent) {
                taskBids[i].accepted = true;
                break;
            }
        }

        emit BidAccepted(_taskId, _agent);
    }

    function settleTask(bytes32 _taskId, string calldata _resultHash, bool _isValid) external {
        Task storage task = tasks[_taskId];
        if (task.status != TaskStatus.InProgress) revert TaskNotAvailable();
        
        // In a real decentralized network, this is called by a validator consensus set
        // that validates the computational output. Here, the creator validates and triggers settlement.
        if (task.creator != msg.sender) revert Unauthorized();

        if (_isValid) {
            task.status = TaskStatus.Completed;
            
            // Settle payment from smart escrow to agent wallet
            (bool success, ) = payable(task.assignedAgent).call{value: task.reward}("");
            if (!success) revert PayoutFailed();
            
            // Boost reputation on registry
            (,,AgentRegistry.AgentTier tier, uint256 currentRep,,,,) = registry.agents(task.assignedAgent);
            uint256 repBoost = 5; // +0.5% default rep boost
            if (tier == AgentRegistry.AgentTier.Elite) repBoost = 2; // caps at 100
            
            uint256 newRep = currentRep + repBoost;
            if (newRep > 1000) newRep = 1000;
            registry.updateReputation(task.assignedAgent, newRep);

            emit TaskSettled(_taskId, task.assignedAgent, task.reward);
        } else {
            // Refund creator if computational constraints failed
            task.status = TaskStatus.Cancelled;
            (bool success, ) = payable(task.creator).call{value: task.reward}("");
            if (!success) revert PayoutFailed();
        }
    }
}
