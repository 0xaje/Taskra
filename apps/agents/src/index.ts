import { TaskraClient, SomniaProvider } from '@taskra/sdk';
import { Agent, Task } from '@taskra/types';

const API_URI = process.env.TASKRA_API_URI || 'http://localhost:3001';
const RPC_URL = process.env.SOMNIA_RPC_URL || 'https://rpc.somnia.network';

const sdk = new TaskraClient({ apiUri: API_URI });
const blockchain = new SomniaProvider({ rpcUrl: RPC_URL });

console.log('🤖 Taskra Autonomous Agent Engine initializing...');
console.log(`🔗 Connecting to Taskra API at: ${API_URI}`);
console.log(`⛓️  Connecting to Somnia Blockchain RPC at: ${RPC_URL}`);

async function runAgentLoop() {
  try {
    // 1. Retrieve all registered agent configurations
    const agents = await sdk.getAgents();
    const activeAgents = agents.filter(a => a.status === 'ACTIVE_BIDDING' || a.status === 'IDLE_SCANNING');

    if (activeAgents.length === 0) {
      console.log('💤 No active agent nodes deployed. Waiting for deployments...');
      return;
    }

    // 2. Fetch all available tasks on the market
    const tasks = await sdk.getTasks();
    const openTasks = tasks.filter(t => t.status === 'OPEN' || t.status === 'NEW');

    if (openTasks.length === 0) {
      console.log('🔍 Active agents scanning market: No open computational tasks found.');
      return;
    }

    // 3. For each active agent, evaluate if it matches any task specifications
    for (const agent of activeAgents) {
      console.log(`🤖 Agent node [${agent.name}] (Tier: ${agent.tier}, Rep: ${agent.rep}) checking bids...`);

      // Find tasks matching agent specialty
      const matchedTasks = openTasks.filter(task => {
        if (agent.specialty === 'Security Auditor' && task.category === 'Security') return true;
        if (agent.specialty === 'Data Analyst' && task.category === 'Data Mining') return true;
        if (agent.specialty === 'Arb Specialist' && task.category === 'Strategy') return true;
        if (agent.specialty === 'Node Latency Tester' && task.category === 'Infrastructure') return true;
        return false;
      });

      for (const task of matchedTasks) {
        // Assert reputation limits
        if (agent.rep < 80 && task.specs.includes('Min Reputation Limit: 90')) {
          console.log(`⚠️ Agent [${agent.name}] reputation (${agent.rep}) is too low for task [${task.id}]`);
          continue;
        }

        console.log(`🎯 Agent [${agent.name}] matched specs for task: "${task.title}" (Reward: ${task.reward} ${task.rewardType})`);
        
        // 4. Submit an autonomous bid using Taskra SDK
        console.log(`🚀 Agent [${agent.name}] submitting on-chain bid on Somnia...`);
        const tx = await blockchain.sendTransaction('SubmitBid', [task.id, agent.id]);
        console.log(`⛓️ Bid registered in Block #${tx.block} | Tx: ${tx.hash}`);

        const newBid = await sdk.submitBid({
          taskId: task.id,
          agentId: agent.id,
          agentName: agent.name,
          agentRep: agent.rep,
          amount: task.reward * 0.95, // Agent requests 95% of pool reward
          asset: task.rewardType
        });
        
        console.log(`✅ Autonomous bid [${newBid.id}] successfully logged in database`);

        // 5. Automate acceptance and computational execution simulation
        console.log(`⚙️  Simulating computational processing workload for task [${task.id}] by [${agent.name}]...`);
        await simulateWorkload(agent, task);
      }
    }
  } catch (error: any) {
    console.error('❌ Error in agent loop iteration:', error.message);
  }
}

async function simulateWorkload(agent: Agent, task: Task) {
  return new Promise<void>((resolve) => {
    setTimeout(async () => {
      try {
        console.log(`⚡ Agent [${agent.name}] computational analysis completed! Generating proof...`);
        
        const resultHash = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        const validationProof = {
          taskId: task.id,
          agentId: agent.id,
          verifierAgentId: 'CONSENSUS_VERIFIER_01',
          resultHash,
          isValid: true,
          signatures: ['0xsig1', '0xsig2'],
          timestamp: new Date().toLocaleTimeString()
        };

        // Trigger on-chain settlement on Somnia block explorer
        console.log(`🏛️ Submitting validated result to Taskra Escrow Contract for payouts...`);
        const settleTx = await blockchain.validateAndSettleOnChain(task.id, agent.id, validationProof);
        console.log(`💰 Escrow Settlement MINTED in Block #${settleTx.block} | Tx Hash: ${settleTx.hash}`);
        console.log(`🎉 Payout of ${task.reward} ${task.rewardType} credited to Agent owner!`);
        
        // Force state update on the API to close task
        // In a full production node, this is synced directly from blockchain transaction event listeners
        await sdk.acceptBid(task.id); // triggers updates
        resolve();
      } catch (err: any) {
        console.error(`❌ Workload completion error for agent ${agent.name}:`, err.message);
        resolve();
      }
    }, 4000); // 4 seconds simulated audit/fuzzing time
  });
}

// Start periodic processing
const intervalTime = Number(process.env.AGENT_TICK_INTERVAL) || 8000; // default 8 seconds
setInterval(runAgentLoop, intervalTime);

// Initial run
runAgentLoop();
