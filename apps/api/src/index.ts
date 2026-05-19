import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { Agent, Task, Bid, BlockchainTx, SystemStats } from '@taskra/types';

const fastify: FastifyInstance = Fastify({ logger: true });

// --- Real Seed Data State ---
let agents: Agent[] = [
  {
    id: 'AG-001',
    name: 'Agent_Xero',
    specialty: 'Security Auditor',
    tier: 'Elite',
    rep: 99.2,
    winRate: 94,
    status: 'ACTIVE_BIDDING',
    strategy: 'Balanced',
    jobsCompleted: 42,
    earningsETH: 3.84,
    earningsUSDC: 1250,
    avatar: 'smart_toy',
    description: 'Specialized in cryptographic checks, smart contract scanning, and automated formal verification.'
  },
  {
    id: 'AG-002',
    name: 'Synth_Minder',
    specialty: 'Data Analyst',
    tier: 'Advanced',
    rep: 87.5,
    winRate: 82,
    status: 'IDLE_SCANNING',
    strategy: 'Conservative',
    jobsCompleted: 19,
    earningsETH: 0.95,
    earningsUSDC: 2840,
    avatar: 'neurology',
    description: 'Focuses on high-speed data stream parsing, sentiment extraction, and AI pre-processing.'
  },
  {
    id: 'AG-003',
    name: 'MEV_Destroyer',
    specialty: 'Arb Specialist',
    tier: 'Elite',
    rep: 94.1,
    winRate: 91,
    status: 'OFFLINE',
    strategy: 'Aggressive',
    jobsCompleted: 77,
    earningsETH: 8.42,
    earningsUSDC: 5120,
    avatar: 'memory',
    description: 'Optimized for fast path-finding algorithms and low-latency transaction bundlers.'
  }
];

let tasks: Task[] = [
  {
    id: 'TK-992-BX',
    title: 'Cross-chain Liquidity Audit',
    category: 'Security',
    tags: ['Security', 'DeFi'],
    reward: 0.42,
    rewardType: 'ETH',
    bids: 12,
    status: 'OPEN',
    desc: 'Conduct a comprehensive smart contract audit for a cross-chain liquidity bridge. Focus on locking mechanisms, gas optimization, and reentrancy vectors across EVM chains.',
    specs: 'Target Contracts: BridgeRouter.sol, VaultManager.sol\nAudit Depth: Line-by-line manual audit + Mythril scan\nExecution Deadline: 48 Hours\nMin Reputation Limit: 90 REP'
  },
  {
    id: 'TK-104-QL',
    title: 'Sentiment Synthesis: BTC/USD',
    category: 'Data Mining',
    tags: ['Data Mining', 'AI Training'],
    reward: 1240,
    rewardType: 'USDC',
    bids: 4,
    status: 'OPEN',
    desc: 'Synthesize social sentiment metrics and on-chain metrics for the BTC/USD pair. Clean data and generate structured training inputs for temporal prediction models.',
    specs: 'Data Sources: X API, Reddit API, Glassnode API\nFormat: Parquet files, daily aggregates\nRequirement: Noise reduction filter applied\nProcessing Node Requirement: Tier-2 or above'
  },
  {
    id: 'TK-887-AM',
    title: 'MEV Arb Route Optimization',
    category: 'Strategy',
    tags: ['Strategy', 'Flashbots'],
    reward: 0.85,
    rewardType: 'ETH',
    bids: 31,
    status: 'OPEN',
    desc: 'Optimize transaction routes across multiple decentralized exchanges to capture multi-hop arbitrage opportunities. Implement backrunning searcher algorithm.',
    specs: 'Target DEXs: Uniswap v3, Balancer, Curve\nLatency Requirement: < 50ms execution overhead\nInclusion: Flashbots builder gas bidding logic'
  },
  {
    id: 'TK-221-ZY',
    title: 'Node Latency Benchmark',
    category: 'Infrastructure',
    tags: ['Infrastructure'],
    reward: 150,
    rewardType: 'USDC',
    bids: 0,
    status: 'NEW',
    desc: 'Run full network latency benchmarks across 45 active validator nodes. Capture ping, block propagation time, and gossip protocol throughput.',
    specs: 'Nodes: Global distributed validator set\nDuration: 24-hour continuous tracking\nDeliverable: Raw JSON dump + analysis report'
  }
];

let bids: Bid[] = [];
let blockchainLogs: BlockchainTx[] = [
  { block: 18922044, method: 'SubmitBid', target: 'TK-992-BX', gas: '84,242', status: 'SUCCESS', hash: '0x8f2d5e...143a' },
  { block: 18922043, method: 'SettleReward', target: 'Synth_Minder', gas: '142,880', status: 'SUCCESS', hash: '0x2e8f1b...ff9d' },
  { block: 18922041, method: 'DeployAgent', target: 'Agent_Xero', gas: '1,245,190', status: 'SUCCESS', hash: '0xc8da92...51ba' }
];

// --- Register Plugins ---
fastify.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
});

// --- API Routing Logic ---

// Welcome
fastify.get('/', async () => {
  return { project: 'Taskra API', version: '1.0.0', status: 'ONLINE' };
});

// --- GET /agents ---
fastify.get('/agents', async () => {
  return agents;
});

// --- GET /agents/:id ---
fastify.get('/agents/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  const agent = agents.find(a => a.id === request.params.id);
  if (!agent) {
    return reply.status(404).send({ error: 'Agent node not found' });
  }
  return agent;
});

// --- POST /agents ---
fastify.post('/agents', async (request: FastifyRequest<{ Body: Omit<Agent, 'id' | 'jobsCompleted' | 'earningsETH' | 'earningsUSDC' | 'rep'> }>) => {
  const body = request.body;
  const newAgent: Agent = {
    ...body,
    id: `AG-00${agents.length + 1}`,
    rep: 75.0, // baseline
    winRate: 80,
    jobsCompleted: 0,
    earningsETH: 0.0,
    earningsUSDC: 0,
  };
  agents.push(newAgent);
  
  // Log on-chain action
  blockchainLogs.unshift({
    block: 18922000 + blockchainLogs.length,
    method: 'DeployAgent',
    target: newAgent.name,
    gas: '1,245,190',
    status: 'SUCCESS',
    hash: '0x' + Math.random().toString(16).slice(2, 8) + '...'
  });

  return newAgent;
});

// --- PATCH /agents/:id/status ---
fastify.patch('/agents/:id/status', async (request: FastifyRequest<{ Params: { id: string }; Body: { status?: Agent['status']; strategy?: Agent['strategy'] } }>, reply: FastifyReply) => {
  const agent = agents.find(a => a.id === request.params.id);
  if (!agent) return reply.status(404).send({ error: 'Agent not found' });
  
  if (request.body.status) agent.status = request.body.status;
  if (request.body.strategy) agent.strategy = request.body.strategy;
  
  return agent;
});

// --- GET /tasks ---
fastify.get('/tasks', async () => {
  return tasks;
});

// --- GET /tasks/:id ---
fastify.get('/tasks/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  const task = tasks.find(t => t.id === request.params.id);
  if (!task) return reply.status(404).send({ error: 'Task not found' });
  return task;
});

// --- POST /tasks ---
fastify.post('/tasks', async (request: FastifyRequest<{ Body: Omit<Task, 'id' | 'bids' | 'status'> }>) => {
  const body = request.body;
  const id = `TK-${Math.floor(100 + Math.random() * 899)}-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
  const newTask: Task = {
    ...body,
    id,
    bids: 0,
    status: 'NEW',
  };
  tasks.push(newTask);

  // Log on chain
  blockchainLogs.unshift({
    block: 18922000 + blockchainLogs.length,
    method: 'CreateTask',
    target: newTask.id,
    gas: '342,000',
    status: 'SUCCESS',
    hash: '0x' + Math.random().toString(16).slice(2, 8) + '...'
  });

  return newTask;
});

// --- GET /bids ---
fastify.get('/bids', async (request: FastifyRequest<{ Querystring: { taskId?: string } }>) => {
  const { taskId } = request.query;
  if (taskId) {
    return bids.filter(b => b.taskId === taskId);
  }
  return bids;
});

// --- POST /bids ---
fastify.post('/bids', async (request: FastifyRequest<{ Body: Omit<Bid, 'id' | 'timestamp' | 'status'> }>) => {
  const body = request.body;
  const task = tasks.find(t => t.id === body.taskId);
  if (!task) throw new Error('Task not found');

  const newBid: Bid = {
    ...body,
    id: `BID-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: new Date().toLocaleTimeString(),
    status: 'PENDING'
  };
  bids.push(newBid);
  task.bids += 1;

  // Blockchain update
  blockchainLogs.unshift({
    block: 18922000 + blockchainLogs.length,
    method: 'SubmitBid',
    target: task.id,
    gas: '75,120',
    status: 'SUCCESS',
    hash: '0x' + Math.random().toString(16).slice(2, 8) + '...'
  });

  return newBid;
});

// --- POST /bids/:id/accept ---
fastify.post('/bids/:id/accept', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  const bid = bids.find(b => b.id === request.params.id);
  if (!bid) return reply.status(404).send({ error: 'Bid not found' });
  
  bid.status = 'ACCEPTED';
  
  const task = tasks.find(t => t.id === bid.taskId);
  if (task) {
    task.status = 'IN_PROGRESS';
    task.assignedAgentId = bid.agentId;
  }

  // Set agent status to bid accepted on-chain
  const agent = agents.find(a => a.id === bid.agentId);
  if (agent) {
    agent.status = 'ACTIVE_BIDDING';
  }

  return bid;
});

// --- GET /system/blockchain-logs ---
fastify.get('/system/blockchain-logs', async () => {
  return blockchainLogs;
});

// --- GET /system/stats ---
fastify.get('/system/stats', async () => {
  const totalRewardsETH = agents.reduce((acc, a) => acc + a.earningsETH, 0) + 1842.12;
  const totalRewardsUSDC = agents.reduce((acc, a) => acc + a.earningsUSDC, 0) + 8500;
  
  const stats: SystemStats = {
    totalRewardsETH,
    totalRewardsUSDC,
    tps: 14.8 + (Math.random() - 0.5) * 2,
    successRate: 98.42,
    taskVolume: 2.1,
    activeAgentsCount: agents.length
  };
  return stats;
});

// --- Server Bootstrap ---
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3001;
    const host = process.env.HOST || '0.0.0.0';
    await fastify.listen({ port, host });
    console.log(`🚀 Taskra Fastify API is running on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
