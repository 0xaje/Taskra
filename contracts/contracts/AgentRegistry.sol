// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentRegistry
 * @notice Manages registration, staking, and reputation of AI agents on Somnia Blockchain
 */
contract AgentRegistry {
    enum AgentTier { Standard, Advanced, Elite }
    enum AgentStatus { Active, Idle, Offline }

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

    mapping(address => AgentNode) public agents;
    address[] public registeredAddresses;

    event AgentRegistered(address indexed agentAddress, string name, AgentTier tier, uint256 stakedAmount);
    event ReputationUpdated(address indexed agentAddress, uint256 newReputation);
    event StatusChanged(address indexed agentAddress, AgentStatus newStatus);
    event StakeRefunded(address indexed agentAddress, uint256 amountRefunded);

    error AgentAlreadyExists();
    error AgentDoesNotExist();
    error InsufficientStake();

    function registerAgent(
        string calldata _name,
        string calldata _specialty,
        AgentTier _tier
    ) external payable {
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
            status: AgentStatus.Active,
            owner: msg.sender,
            isRegistered: true
        });

        registeredAddresses.push(msg.sender);

        emit AgentRegistered(msg.sender, _name, _tier, msg.value);
    }

    function updateReputation(address _agent, uint256 _newRep) external {
        // In production, this would be restricted to verified validator nodes or marketplace controller
        if (!agents[_agent].isRegistered) revert AgentDoesNotExist();
        require(_newRep <= 1000, "Reputation cannot exceed 100%");
        
        agents[_agent].reputation = _newRep;
        emit ReputationUpdated(_agent, _newRep);
    }

    function setStatus(AgentStatus _status) external {
        if (!agents[msg.sender].isRegistered) revert AgentDoesNotExist();
        agents[msg.sender].status = _status;
        emit StatusChanged(msg.sender, _status);
    }

    function decommissionAgent() external {
        if (!agents[msg.sender].isRegistered) revert AgentDoesNotExist();
        
        AgentNode storage agent = agents[msg.sender];
        uint256 refundAmount = agent.stake / 2; // refund 50% as per specifications
        
        delete agents[msg.sender];
        
        // Remove from registered addresses array
        for (uint256 i = 0; i < registeredAddresses.length; i++) {
            if (registeredAddresses[i] == msg.sender) {
                registeredAddresses[i] = registeredAddresses[registeredAddresses.length - 1];
                registeredAddresses.pop();
                break;
            }
        }

        payable(msg.sender).transfer(refundAmount);
        emit StakeRefunded(msg.sender, refundAmount);
    }

    function getAgent(address _agent) external view returns (AgentNode memory) {
        if (!agents[_agent].isRegistered) revert AgentDoesNotExist();
        return agents[_agent];
    }
}
