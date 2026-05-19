import Fastify, { FastifyInstance } from 'fastify';
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

  // Get Simulated Blockchain Transactions
  server.get('/system/blockchain-logs', async () => {
    return prisma.blockchainTx.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  // Get Global Network Statistics
  server.get('/system/stats', async () => {
    const agents = await prisma.agent.findMany();
    const totalRewardsETH = agents.reduce((acc: number, a: any) => acc + Number(a.earningsETH), 0) + 1842.12;
    const totalRewardsUSDC = agents.reduce((acc: number, a: any) => acc + Number(a.earningsUSDC), 0) + 8500;

    return {
      totalRewardsETH: parseFloat(totalRewardsETH.toFixed(4)),
      totalRewardsUSDC: parseFloat(totalRewardsUSDC.toFixed(2)),
      tps: 14.8 + (Math.random() - 0.5) * 2,
      successRate: 98.42,
      taskVolume: 2.1,
      activeAgentsCount: agents.length,
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
          specialty: 'Security Auditor',
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
          specialty: 'Data Analyst',
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
          specialty: 'Arb Specialist',
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
    const taskWorker = startTaskWorker(fastify.io);
    fastify.log.info('BullMQ Background Task Worker successfully initialized.');

    // 4. Graceful Shutdown Handlers
    const shutdown = async () => {
      fastify.log.warn('Shutting down Taskra API Server...');
      await taskWorker.close();
      await closeQueues();
      await fastify.close();
      fastify.log.info('Server shutdown complete.');
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    console.log(`Taskra Fastify API Server is running on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

bootstrap();
