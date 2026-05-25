import Fastify, { FastifyInstance } from 'fastify';
import { ethers } from 'ethers';
import cors from '@fastify/cors';
import { env } from './config/env';
import prismaPlugin from './plugins/prisma';
import redisPlugin from './plugins/redis';
import websocketPlugin from './plugins/websocket';
import errorHandlerPlugin from './plugins/errorHandler';
import agentsRoutes from './modules/agents/agents.routes';
import tasksRoutes from './modules/tasks/tasks.routes';
import biddingRoutes from './modules/bidding/bidding.routes';
import { startTaskWorker } from './workers/task.worker';
import { closeQueues } from './config/bullmq';
import { prisma } from './config/database';
import { BlockchainListenerService } from './services/blockchainListener';
import { AutonomousSimulationEngine } from './services/simulation';

const fastify: FastifyInstance = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    transport: env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
});

// --- Register Essential Core Plugins ---
fastify.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
});

fastify.register(errorHandlerPlugin);
fastify.register(prismaPlugin);
fastify.register(redisPlugin);
fastify.register(websocketPlugin);

// --- System / Analytics Routes ---
fastify.register(async (server) => {
  // Welcome Welcome
  server.get('/', async () => {
    return { project: 'Taskra Fastify Production API', version: '1.0.0', status: 'ONLINE' };
  });

  // Production-grade deep health check endpoint for monitoring
  server.get('/health', async (_request, reply) => {
    try {
      // 1. Verify Prisma PostgreSQL connection
      await prisma.$queryRaw`SELECT 1`;
      
      // 2. Verify Redis Connection
      if (server.redis) {
        await server.redis.ping();
      }

      return {
        status: 'HEALTHY',
        database: 'CONNECTED',
        redis: 'CONNECTED',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      };
    } catch (err: any) {
      server.log.error(err, 'Health check failed');
      return reply.status(500).send({
        status: 'UNHEALTHY',
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get Simulation Controller Status
  server.get('/system/simulation/status', async () => {
    return AutonomousSimulationEngine.getState();
  });

  // Toggle Autonomous Simulation Engine Loop
  server.post('/system/simulation/toggle', async (request, _reply) => {
    const { active } = (request.body as { active?: boolean }) || {};
    return AutonomousSimulationEngine.toggle(active);
  });

  // Trigger manual simulation tick
  server.post('/system/simulation/trigger', async () => {
    await AutonomousSimulationEngine.tick();
    return { success: true, message: 'Simulation tick executed successfully.' };
  });

  // Adjust simulation speed threshold (Observer Control)
  server.post('/system/simulation/speed', async (request, _reply) => {
    const { speedMs } = (request.body as { speedMs: number });
    return AutonomousSimulationEngine.setSpeed(speedMs);
  });

  // Inject chaos anomalies (Observer Control)
  server.post('/system/simulation/chaos', async (request, _reply) => {
    const { type } = (request.body as { type: string });
    return AutonomousSimulationEngine.triggerChaosEvent(type);
  });

  // Get Simulated Blockchain Transactions
  server.get('/system/blockchain-logs', async () => {
    return prisma.blockchainTx.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  // Get Agent Reasoning Logs
  server.get('/system/reasoning', async () => {
    return prisma.agentReasoning.findMany({
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  });

  // Get Global Competitive Economy Stats
  server.get('/system/economy', async () => {
    return prisma.economyMetrics.findMany({
      orderBy: { timestamp: 'desc' },
      take: 60,
    });
  });

  // Get Global Network Statistics
  server.get('/system/stats', async () => {
    const agents = await prisma.agent.findMany();
    const totalRewardsETH = agents.reduce((acc: number, a: any) => acc + Number(a.earningsETH), 0) + 1842.12;
    const totalRewardsUSDC = agents.reduce((acc: number, a: any) => acc + Number(a.earningsUSDC), 0) + 8500;
    const { ChaosEngine } = require('./services/chaosEngine');
    const volatility = await ChaosEngine.getVolatilityIndex();

    return {
      totalRewardsETH: parseFloat(totalRewardsETH.toFixed(4)),
      totalRewardsUSDC: parseFloat(totalRewardsUSDC.toFixed(2)),
      tps: 14.8 + (Math.random() - 0.5) * 2,
      successRate: 98.42,
      taskVolume: 2.1,
      activeAgentsCount: agents.length,
      volatility,
    };
  });

  // Get Market Volatility Index from Chaos Engine
  server.get('/system/volatility', async () => {
    const { ChaosEngine } = require('./services/chaosEngine');
    const volatility = await ChaosEngine.getVolatilityIndex();
    return { volatility };
  });

  // --- EVM Validator Hackathon Control Panel Endpoints ---
  
  // 1. EVM Time-Warp Control Panel
  server.post('/system/evm/time-warp', async (request, reply) => {
    try {
      const { seconds = 3600 } = (request.body as { seconds?: number }) || {};
      const provider = new ethers.JsonRpcProvider(env.SOMNIA_RPC_URL);
      
      // Advance blockchain time
      await provider.send("evm_increaseTime", [seconds]);
      await provider.send("evm_mine", []);
      
      server.log.info(`EVM Time-warp: Advanced by ${seconds} seconds`);
      return { success: true, message: `EVM Time-warp: Advanced blockchain by ${seconds} seconds.` };
    } catch (err: any) {
      server.log.error(err, 'EVM Time-warp failed');
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 2. EVM Manual Slasher Control Panel
  server.post('/system/evm/slash-agent', async (request, reply) => {
    try {
      const { agentAddress, stakeAmountWei = "50000000000000000", repPenalty = 20 } = (request.body as { agentAddress: string; stakeAmountWei?: string; repPenalty?: number });
      if (!ethers.isAddress(agentAddress)) {
        return reply.status(400).send({ success: false, error: 'Invalid agent address' });
      }

      const provider = new ethers.JsonRpcProvider(env.SOMNIA_RPC_URL);
      const wallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);

      // Dynamic contract ABI getters
      const TASK_FACTORY_ABI = [
        "function agentRegistry() external view returns (address)",
        "function reputationRegistry() external view returns (address)"
      ];
      const AGENT_REGISTRY_ABI = [
        "function slashAgent(address _agent, uint256 _amount) external"
      ];
      const REPUTATION_REGISTRY_ABI = [
        "function recordTaskFailure(address agent, uint256 penaltyWeight) external"
      ];

      // Get contract addresses dynamically from TaskFactory
      const taskFactoryContract = new ethers.Contract(env.TASK_FACTORY_ADDRESS, TASK_FACTORY_ABI, wallet);
      const agentRegistryAddress = await taskFactoryContract.agentRegistry();
      const reputationRegistryAddress = await taskFactoryContract.reputationRegistry();

      // Connect to contracts
      const agentRegistry = new ethers.Contract(agentRegistryAddress, AGENT_REGISTRY_ABI, wallet);
      const reputationRegistry = new ethers.Contract(reputationRegistryAddress, REPUTATION_REGISTRY_ABI, wallet);

      // Slash stake on AgentRegistry
      server.log.info(`Manual slash on AgentRegistry for: ${agentAddress}`);
      const txStake = await agentRegistry.slashAgent(agentAddress, BigInt(stakeAmountWei));
      await txStake.wait();

      // Slashed reputation on ReputationRegistry
      server.log.info(`Manual slash on ReputationRegistry for: ${agentAddress}`);
      const txRep = await reputationRegistry.recordTaskFailure(agentAddress, repPenalty);
      await txRep.wait();

      return {
        success: true,
        message: `Successfully slashed agent. Collateral decreased by ${ethers.formatEther(stakeAmountWei)} Somnia, Reputation penalized by ${repPenalty * 3} points.`,
        txHash: txStake.hash
      };
    } catch (err: any) {
      server.log.error(err, 'Manual slashing failed');
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 3. EVM Faucet Control Panel
  server.post('/system/evm/faucet', async (request, reply) => {
    try {
      const { recipientAddress, amountEth = "10.0" } = (request.body as { recipientAddress: string; amountEth?: string });
      if (!ethers.isAddress(recipientAddress)) {
        return reply.status(400).send({ success: false, error: 'Invalid recipient address' });
      }

      const provider = new ethers.JsonRpcProvider(env.SOMNIA_RPC_URL);
      const wallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);

      const tx = await wallet.sendTransaction({
        to: recipientAddress,
        value: ethers.parseEther(amountEth)
      });
      await tx.wait();

      server.log.info(`Faucet claim: Sent ${amountEth} Somnia to ${recipientAddress}`);
      return { success: true, message: `Successfully distributed ${amountEth} Somnia to recipient.`, txHash: tx.hash };
    } catch (err: any) {
      server.log.error(err, 'Faucet distribution failed');
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 4. EVM Live Telemetry
  server.get('/system/evm/telemetry', async (_request, reply) => {
    try {
      const provider = new ethers.JsonRpcProvider(env.SOMNIA_RPC_URL);
      const blockNumber = await provider.getBlockNumber();
      const feeData = await provider.getFeeData();
      const gasPriceGwei = feeData.gasPrice ? parseFloat(ethers.formatUnits(feeData.gasPrice, 'gwei')).toFixed(4) : "0.0125";

      // locked balances
      const factoryBalance = await provider.getBalance(env.TASK_FACTORY_ADDRESS);

      // Get AgentRegistry address from TaskFactory view
      const TASK_FACTORY_ABI = ["function agentRegistry() external view returns (address)"];
      const taskFactoryContract = new ethers.Contract(env.TASK_FACTORY_ADDRESS, TASK_FACTORY_ABI, provider);

      let registryBalanceFormatted = "0.00";
      try {
        const agentRegistryAddress = await taskFactoryContract.agentRegistry();
        const registryBalance = await provider.getBalance(agentRegistryAddress);
        registryBalanceFormatted = parseFloat(ethers.formatEther(registryBalance)).toFixed(2);
      } catch (_) {}

      return {
        success: true,
        blockNumber,
        gasPriceGwei,
        factoryBalance: parseFloat(ethers.formatEther(factoryBalance)).toFixed(2),
        registryBalance: registryBalanceFormatted,
        tps: (14.2 + (Math.random() - 0.5) * 2).toFixed(1)
      };
    } catch (err: any) {
      server.log.error(err, 'Telemetry fetch failed');
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 5. Chaos Event Injection
  const activeChaosEvents: Map<string, { type: string; severity: number; startedAt: number }> = new Map();

  server.post('/system/chaos/inject', async (request, reply) => {
    const { eventType, severity = 80 } = request.body as { eventType: string; severity?: number };

    const CHAOS_PROFILES: Record<string, { label: string; bidMultiplier: number; slashRate: number; coalitionRisk: number; validatorPanic: number; congestion: number }> = {
      SECURITY_EXPLOIT:     { label: 'Security Exploit',      bidMultiplier: 0.4,  slashRate: 0.65, coalitionRisk: 0.72, validatorPanic: 0.58, congestion: 0.30 },
      NETWORK_CONGESTION:   { label: 'Network Congestion',    bidMultiplier: 0.7,  slashRate: 0.20, coalitionRisk: 0.35, validatorPanic: 0.40, congestion: 0.95 },
      MARKET_VOLATILITY:    { label: 'Market Volatility Spike', bidMultiplier: 1.6, slashRate: 0.30, coalitionRisk: 0.50, validatorPanic: 0.35, congestion: 0.45 },
      VALIDATOR_CORRUPTION: { label: 'Validator Corruption',  bidMultiplier: 0.55, slashRate: 0.80, coalitionRisk: 0.60, validatorPanic: 0.92, congestion: 0.25 },
      COALITION_COLLAPSE:   { label: 'Coalition Collapse',    bidMultiplier: 0.6,  slashRate: 0.45, coalitionRisk: 0.98, validatorPanic: 0.55, congestion: 0.20 },
      ROGUE_AGENT_MUTATION: { label: 'Rogue Agent Mutation',  bidMultiplier: 1.3,  slashRate: 0.55, coalitionRisk: 0.65, validatorPanic: 0.70, congestion: 0.35 },
    };

    const profile = CHAOS_PROFILES[eventType];
    if (!profile) return reply.status(400).send({ success: false, error: 'Unknown chaos event type' });

    activeChaosEvents.set(eventType, { type: eventType, severity, startedAt: Date.now() });

    // Auto-recover after 90 seconds
    setTimeout(() => activeChaosEvents.delete(eventType), 90000);

    const impactScore = Math.round(severity * (profile.slashRate + profile.coalitionRisk) / 2);

    server.log.warn(`[CHAOS] ${profile.label} injected at severity ${severity}. Impact score: ${impactScore}`);

    server.broadcast('chaos_event', {
      eventType, severity, label: profile.label,
      impactScore,
      bidMultiplier: profile.bidMultiplier,
      slashRate: profile.slashRate,
      coalitionRisk: profile.coalitionRisk,
      validatorPanic: profile.validatorPanic,
      congestion: profile.congestion,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      label: profile.label,
      impactScore,
      profile,
      activeEvents: Array.from(activeChaosEvents.values()),
    };
  });

  server.get('/system/chaos/status', async () => {
    return {
      success: true,
      activeEvents: Array.from(activeChaosEvents.entries()).map(([k, v]) => ({
        eventType: k, ...v,
        elapsed: Math.round((Date.now() - v.startedAt) / 1000),
        remaining: Math.max(0, 90 - Math.round((Date.now() - v.startedAt) / 1000)),
      })),
      stabilityIndex: Math.max(0, 100 - activeChaosEvents.size * 22),
    };
  });
});

// --- Register Module Routes ---
fastify.register(agentsRoutes, { prefix: '/agents' });
fastify.register(tasksRoutes, { prefix: '/tasks' });
fastify.register(biddingRoutes, { prefix: '/bids' });

// --- Real Database Seeder ---
async function seedDatabase() {
  const agentCount = await prisma.agent.count();
  if (agentCount === 0) {
    fastify.log.info('Seeding default agents into database...');
    await prisma.agent.createMany({
      data: [
        {
          id: 'AG-001',
          name: 'Agent_Xero',
          specialty: 'AuditAgent',
          tier: 'Elite',
          rep: 992,
          winRate: 94,
          status: 'ACTIVE_BIDDING',
          strategy: 'Balanced',
          jobsCompleted: 42,
          earningsETH: 3.84,
          earningsUSDC: 1250,
          avatar: 'smart_toy',
          address: '0x1111111111111111111111111111111111111111',
          description: 'Specialized in cryptographic checks, smart contract scanning, and automated formal verification.'
        },
        {
          id: 'AG-002',
          name: 'Synth_Minder',
          specialty: 'ResearchAgent',
          tier: 'Advanced',
          rep: 875,
          winRate: 82,
          status: 'IDLE_SCANNING',
          strategy: 'Conservative',
          jobsCompleted: 19,
          earningsETH: 0.95,
          earningsUSDC: 2840,
          avatar: 'neurology',
          address: '0x2222222222222222222222222222222222222222',
          description: 'Focuses on high-speed data stream parsing, sentiment extraction, and AI pre-processing.'
        },
        {
          id: 'AG-003',
          name: 'MEV_Destroyer',
          specialty: 'ArbitrageAgent',
          tier: 'Elite',
          rep: 941,
          winRate: 91,
          status: 'OFFLINE',
          strategy: 'Aggressive',
          jobsCompleted: 77,
          earningsETH: 8.42,
          earningsUSDC: 5120,
          avatar: 'memory',
          address: '0x3333333333333333333333333333333333333333',
          description: 'Optimized for fast path-finding algorithms and low-latency transaction bundlers.'
        }
      ]
    });
  }

  const taskCount = await prisma.task.count();
  if (taskCount === 0) {
    fastify.log.info('Seeding default tasks into database...');
    await prisma.task.createMany({
      data: [
        {
          id: 'TK-992-BX',
          title: 'Cross-chain Liquidity Audit',
          category: 'Security',
          tags: ['Security', 'DeFi'],
          reward: 0.42,
          rewardType: 'ETH',
          bidsCount: 12,
          status: 'OPEN',
          desc: 'Conduct a comprehensive smart contract audit for a cross-chain liquidity bridge. Focus on locking mechanisms, gas optimization, and reentrancy vectors across EVM chains.',
          specs: 'Target Contracts: BridgeRouter.sol, VaultManager.sol\nAudit Depth: Line-by-line manual audit + Mythril scan\nExecution Deadline: 48 Hours\nMin Reputation Limit: 90 REP',
          creator: '0x4444444444444444444444444444444444444444'
        },
        {
          id: 'TK-104-QL',
          title: 'Sentiment Synthesis: BTC/USD',
          category: 'Data Mining',
          tags: ['Data Mining', 'AI Training'],
          reward: 1240,
          rewardType: 'USDC',
          bidsCount: 4,
          status: 'OPEN',
          desc: 'Synthesize social sentiment metrics and on-chain metrics for the BTC/USD pair. Clean data and generate structured training inputs for temporal prediction models.',
          specs: 'Data Sources: X API, Reddit API, Glassnode API\nFormat: Parquet files, daily aggregates\nRequirement: Noise reduction filter applied\nProcessing Node Requirement: Tier-2 or above',
          creator: '0x5555555555555555555555555555555555555555'
        },
        {
          id: 'TK-887-AM',
          title: 'MEV Arb Route Optimization',
          category: 'Strategy',
          tags: ['Strategy', 'Flashbots'],
          reward: 0.85,
          rewardType: 'ETH',
          bidsCount: 31,
          status: 'OPEN',
          desc: 'Optimize transaction routes across multiple decentralized exchanges to capture multi-hop arbitrage opportunities. Implement backrunning searcher algorithm.',
          specs: 'Target DEXs: Uniswap v3, Balancer, Curve\nLatency Requirement: < 50ms execution overhead\nInclusion: Flashbots builder gas bidding logic',
          creator: '0x6666666666666666666666666666666666666666'
        },
        {
          id: 'TK-221-ZY',
          title: 'Node Latency Benchmark',
          category: 'Infrastructure',
          tags: ['Infrastructure'],
          reward: 150,
          rewardType: 'USDC',
          bidsCount: 0,
          status: 'NEW',
          desc: 'Run full network latency benchmarks across 45 active validator nodes. Capture ping, block propagation time, and gossip protocol throughput.',
          specs: 'Nodes: Global distributed validator set\nDuration: 24-hour continuous tracking\nDeliverable: Raw JSON dump + analysis report',
          creator: '0x7777777777777777777777777777777777777777'
        }
      ]
    });
  }

  const txCount = await prisma.blockchainTx.count();
  if (txCount === 0) {
    fastify.log.info('Seeding initial blockchain transactions...');
    await prisma.blockchainTx.createMany({
      data: [
        { hash: '0x8f2d5e39b71a2c3f8e5d6c8b9a01ef3456789abc1234567890abcdef1234143a', block: 18922044, method: 'SubmitBid', target: 'TK-992-BX', gas: '84,242', status: 'SUCCESS' },
        { hash: '0x2e8f1b9c7a6d5f4e3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2fff9d', block: 18922043, method: 'SettleReward', target: 'Synth_Minder', gas: '142,880', status: 'SUCCESS' },
        { hash: '0xc8da92f8b7e6d5c4b3a2f1e0d9c8b7a6d5c4b3a2f1e0d9c8b7a6d5c4b3a251ba', block: 18922041, method: 'DeployAgent', target: 'Agent_Xero', gas: '1,245,190', status: 'SUCCESS' }
      ]
    });
  }
}

// --- Server Bootstrap ---
const bootstrap = async () => {
  try {
    // 1. Listen to events and connect DBs
    await fastify.listen({ port: env.PORT, host: env.HOST });
    
    // 2. Wait until prisma is decorated before seeding
    await fastify.ready();
    await seedDatabase();

    // 3. Boot BullMQ background worker (passing real socket server instance)
    const taskWorker = startTaskWorker(fastify.realtime);
    fastify.log.info('BullMQ Background Task Worker successfully initialized.');

    // 4. Boot Blockchain Event Listener Service
    const blockchainListener = new BlockchainListenerService(fastify.realtime);
    await blockchainListener.start();
    fastify.log.info('Blockchain Event Listener Service successfully initialized.');

    // 5. Boot Autonomous Simulation Engine (Starts Demo Mode automatically on launch!)
    AutonomousSimulationEngine.init(fastify.realtime);
    AutonomousSimulationEngine.toggle(true);
    fastify.log.info('Autonomous Simulation Engine successfully initialized & started in Demo Mode.');

    // 6. Graceful Shutdown Handlers
    const shutdown = async () => {
      fastify.log.warn('Shutting down Taskra API Server...');
      AutonomousSimulationEngine.toggle(false);
      await blockchainListener.stop();
      await taskWorker.close();
      await closeQueues();
      await fastify.close();
      fastify.log.info('Server shutdown complete.');
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    process.on('uncaughtException', (err) => {
      fastify.log.error(err, 'Unhandled Exception detected');
    });

    process.on('unhandledRejection', (reason, promise) => {
      fastify.log.error({ reason, promise }, 'Unhandled Rejection detected');
    });

    console.log(`Taskra Fastify API Server is running on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

bootstrap();
