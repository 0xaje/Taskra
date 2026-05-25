import { ethers } from 'ethers';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { RealtimeService } from './realtime';
import { Prisma } from '@prisma/client';
import { Settlement, SystemEventLog } from '@taskra/types';

// ABI for the TaskFactory contract events
const TASK_FACTORY_ABI = [
  'event TaskCreated(bytes32 indexed id, address indexed creator, string metadataURI, uint256 rewardAmount, uint256 createdAt)',
  'event TaskAssigned(bytes32 indexed id, address indexed assignedAgent, uint256 timestamp)',
  'event TaskStarted(bytes32 indexed id, uint256 timestamp)',
  'event TaskCompleted(bytes32 indexed id, uint256 timestamp)',
  'event TaskCompletedWithProof(bytes32 indexed id, address indexed assignedAgent, bytes32 proofHash, uint256 timestamp)',
  'event TaskSettled(bytes32 indexed id, address indexed assignedAgent, uint256 rewardAmount, uint256 timestamp)',
  'event TaskCancelled(bytes32 indexed id, address indexed creator, uint256 refundedAmount, uint256 timestamp)',
  'event ValidatorVoted(bytes32 indexed id, address indexed validator, bool isValid, uint256 timestamp)',
  'event TaskDisputed(bytes32 indexed id, address indexed raisedBy, string reason, uint256 timestamp)',
  'event TaskSlashed(bytes32 indexed id, address indexed assignedAgent, uint256 slashedAmount, uint256 timestamp)',
  'event EscrowArbitrated(bytes32 indexed id, address indexed arbiter, bool paidAgent, uint256 timestamp)'
];

export class BlockchainListenerService {
  private provider: ethers.WebSocketProvider | ethers.JsonRpcProvider | null = null;
  private contract: ethers.Contract | null = null;
  private isRunning: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectDelay = 5000; // Start with 5s delay
  private maxReconnectDelay = 60000; // Cap at 60s
  private lastProcessedBlockKey = 'taskra:blockchain:last_processed_block';
  private isMockListenerRunning = false;
  private mockIntervalId: NodeJS.Timeout | null = null;

  constructor(private realtime: RealtimeService) {}

  /**
   * Initializes and starts the blockchain event listener daemon.
   */
  public async start() {
    if (this.isRunning) {
      console.log('Blockchain Listener Service is already running.');
      return;
    }
    this.isRunning = true;
    console.log('Starting Blockchain Listener Service...');
    await this.connect();
  }

  /**
   * Gracefully shuts down the listener.
   */
  public async stop() {
    this.isRunning = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.mockIntervalId) {
      clearInterval(this.mockIntervalId);
      this.mockIntervalId = null;
      this.isMockListenerRunning = false;
    }
    if (this.provider) {
      try {
        if (this.provider instanceof ethers.WebSocketProvider) {
          await this.provider.destroy();
        }
      } catch (err: any) {
        console.error('Error destroying ethers websocket provider:', err.message);
      }
    }
    console.log('Blockchain Listener Service stopped.');
  }

  /**
   * Establishes a WebSocket connection to the Somnia network RPC.
   * Leverages exponential backoff reconnects and falls back to HTTP Polling if WebSocket is not available.
   */
  private async connect() {
    try {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }

      const contractAddress = env.TASK_FACTORY_ADDRESS;
      const isSandboxMode = !contractAddress || contractAddress === ethers.ZeroAddress;

      if (isSandboxMode) {
        console.warn('TASK_FACTORY_ADDRESS is set to ZeroAddress or not defined. Listener will run in diagnostic sandbox mode.');
        this.provider = null;
        this.contract = null;
        this.startDiagnosticMockListener();
        return;
      }

      console.log(`Connecting to Somnia Network. WS: ${env.SOMNIA_WS_URL} | HTTP: ${env.SOMNIA_RPC_URL}`);

      // Pre-flight reachability check to prevent unhandled event loop connection refuse crashes
      let isRpcOnline = false;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);
        const pingResponse = await fetch(env.SOMNIA_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'net_listening', params: [], id: 1 }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (pingResponse.ok) {
          isRpcOnline = true;
        }
      } catch (pingError: any) {
        isRpcOnline = false;
      }

      if (!isRpcOnline) {
        console.warn('Somnia local RPC node is currently offline. Skipping connection and running in diagnostic sandbox mode.');
        this.provider = null;
        this.contract = null;
        this.startDiagnosticMockListener();
        this.handleDisconnect();
        return;
      }

      let connected = false;

      // 1. Attempt WebSocket connection
      try {
        // Create WS provider - wrap with error events immediately to prevent process crashes on DNS failures
        const wsProvider = new ethers.WebSocketProvider(env.SOMNIA_WS_URL);
        
        // Register early error handler on websocket provider
        wsProvider.on('error', (err) => {
          console.error('WebSocket connection or DNS resolution failed asynchronously:', err);
        });

        // Force test connection
        await wsProvider.getBlockNumber();
        this.provider = wsProvider;
        console.log('Successfully connected to Somnia via WebSocket!');
        this.reconnectDelay = 5000; // Reset delay on success
        connected = true;
      } catch (wsError: any) {
        console.warn(`WebSocket connection failed: ${wsError.message}. Falling back to HTTP JsonRpcProvider.`);
        try {
          // Fallback to JSON-RPC HTTP provider
          const rpcProvider = new ethers.JsonRpcProvider(env.SOMNIA_RPC_URL);
          await rpcProvider.getBlockNumber();
          this.provider = rpcProvider;
          console.log('Connected to Somnia via HTTP Polling.');
          connected = true;
        } catch (rpcError: any) {
          console.error(`HTTP JsonRpcProvider fallback also failed: ${rpcError.message}`);
        }
      }

      if (connected && this.provider) {
        // If there was a mock interval running, clear it since we are online now
        if (this.mockIntervalId) {
          clearInterval(this.mockIntervalId);
          this.mockIntervalId = null;
          this.isMockListenerRunning = false;
        }

        // 2. Setup Contract instance
        this.contract = new ethers.Contract(contractAddress, TASK_FACTORY_ABI, this.provider);
        
        // Register real-time listeners
        this.registerContractListeners();
        
        // Catch up on missed events during offline downtime
        await this.catchUpMissedEvents();

        // 3. Setup WebSocket connection death/error hooks
        if (this.provider instanceof ethers.WebSocketProvider) {
          this.provider.on('error', (err) => {
            console.error('Websocket Provider Error:', err);
            this.handleDisconnect();
          });
        }
      } else {
        console.warn('Unable to connect to Somnia network. Listener will run in offline diagnostic sandbox mode.');
        this.provider = null;
        this.contract = null;
        this.startDiagnosticMockListener();
        this.handleDisconnect();
      }

    } catch (err: any) {
      console.error(`Unexpected failure connecting to Somnia RPC: ${err.message}. Retrying...`);
      this.provider = null;
      this.contract = null;
      this.startDiagnosticMockListener();
      this.handleDisconnect();
    }
  }

  /**
   * Handles disconnections and triggers automatic reconnection with exponential backoff.
   */
  private handleDisconnect() {
    if (!this.isRunning) return;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    console.log(`Scheduling reconnect attempt in ${this.reconnectDelay / 1000} seconds...`);

    this.reconnectTimeout = setTimeout(async () => {
      await this.connect();
    }, this.reconnectDelay);
  }

  /**
   * Registers listeners for live contract events.
   */
  private registerContractListeners() {
    if (!this.contract) return;

    console.log(`Registering event listeners on TaskFactory at: ${env.TASK_FACTORY_ADDRESS}`);

    this.contract.on('TaskCreated', async (id, creator, metadataURI, rewardAmount, createdAt, eventPayload) => {
      await this.safeExecuteEvent('TaskCreated', eventPayload, async () => {
        await this.handleTaskCreated(id, creator, metadataURI, rewardAmount, createdAt, eventPayload);
      });
    });

    this.contract.on('TaskAssigned', async (id, assignedAgent, timestamp, eventPayload) => {
      await this.safeExecuteEvent('TaskAssigned', eventPayload, async () => {
        await this.handleTaskAssigned(id, assignedAgent, timestamp, eventPayload);
      });
    });

    this.contract.on('TaskStarted', async (id, timestamp, eventPayload) => {
      await this.safeExecuteEvent('TaskStarted', eventPayload, async () => {
        await this.handleTaskStarted(id, timestamp, eventPayload);
      });
    });

    this.contract.on('TaskCompleted', async (id, timestamp, eventPayload) => {
      await this.safeExecuteEvent('TaskCompleted', eventPayload, async () => {
        await this.handleTaskCompleted(id, timestamp, eventPayload);
      });
    });

    this.contract.on('TaskSettled', async (id, assignedAgent, rewardAmount, timestamp, eventPayload) => {
      await this.safeExecuteEvent('TaskSettled', eventPayload, async () => {
        await this.handleTaskSettled(id, assignedAgent, rewardAmount, timestamp, eventPayload);
      });
    });

    this.contract.on('TaskCancelled', async (id, creator, refundedAmount, timestamp, eventPayload) => {
      await this.safeExecuteEvent('TaskCancelled', eventPayload, async () => {
        await this.handleTaskCancelled(id, creator, refundedAmount, timestamp, eventPayload);
      });
    });

    this.contract.on('TaskCompletedWithProof', async (id, assignedAgent, proofHash, timestamp, eventPayload) => {
      await this.safeExecuteEvent('TaskCompletedWithProof', eventPayload, async () => {
        await this.handleTaskCompletedWithProof(id, assignedAgent, proofHash, timestamp, eventPayload);
      });
    });

    this.contract.on('ValidatorVoted', async (id, validator, isValid, timestamp, eventPayload) => {
      await this.safeExecuteEvent('ValidatorVoted', eventPayload, async () => {
        await this.handleValidatorVoted(id, validator, isValid, timestamp, eventPayload);
      });
    });

    this.contract.on('TaskDisputed', async (id, raisedBy, reason, timestamp, eventPayload) => {
      await this.safeExecuteEvent('TaskDisputed', eventPayload, async () => {
        await this.handleTaskDisputed(id, raisedBy, reason, timestamp, eventPayload);
      });
    });

    this.contract.on('TaskSlashed', async (id, assignedAgent, slashedAmount, timestamp, eventPayload) => {
      await this.safeExecuteEvent('TaskSlashed', eventPayload, async () => {
        await this.handleTaskSlashed(id, assignedAgent, slashedAmount, timestamp, eventPayload);
      });
    });

    this.contract.on('EscrowArbitrated', async (id, arbiter, paidAgent, timestamp, eventPayload) => {
      await this.safeExecuteEvent('EscrowArbitrated', eventPayload, async () => {
        await this.handleEscrowArbitrated(id, arbiter, paidAgent, timestamp, eventPayload);
      });
    });
  }

  /**
   * Scans previous blocks to process events that occurred while the listener was offline.
   */
  private async catchUpMissedEvents() {
    if (!this.provider || !this.contract) return;

    try {
      const currentBlock = await this.provider.getBlockNumber();
      const lastProcessedBlockStr = await redis.get(this.lastProcessedBlockKey);
      
      // Default to scanning last 1000 blocks if no record exists
      let startBlock = lastProcessedBlockStr 
        ? parseInt(lastProcessedBlockStr, 10) + 1 
        : currentBlock - 1000;

      if (startBlock < 0) startBlock = 0;

      if (startBlock >= currentBlock) {
        console.log('Database state is up-to-date with blockchain. No catch-up required.');
        return;
      }

      console.log(`Catching up missed blockchain events from block #${startBlock} to #${currentBlock}...`);

      // Retrieve past events in batches of 100 blocks to prevent RPC timeouts
      const batchSize = 100;
      for (let fromBlock = startBlock; fromBlock <= currentBlock; fromBlock += batchSize) {
        const toBlock = Math.min(fromBlock + batchSize - 1, currentBlock);
        
        const filter = {
          address: env.TASK_FACTORY_ADDRESS,
          fromBlock,
          toBlock
        };

        const logs = await this.provider.getLogs(filter);
        for (const log of logs) {
          try {
            const parsedLog = this.contract.interface.parseLog(log);
            if (!parsedLog) continue;

            const txHash = log.transactionHash;
            const blockNumber = log.blockNumber;

            // Mock an event payload for execution
            const mockPayload = {
              log,
              transactionHash: txHash,
              blockNumber
            };

            await this.safeExecuteEvent(parsedLog.name, mockPayload, async () => {
              const args = parsedLog.args;
              if (parsedLog.name === 'TaskCreated') {
                await this.handleTaskCreated(args[0], args[1], args[2], args[3], args[4], mockPayload);
              } else if (parsedLog.name === 'TaskAssigned') {
                await this.handleTaskAssigned(args[0], args[1], args[2], mockPayload);
              } else if (parsedLog.name === 'TaskStarted') {
                await this.handleTaskStarted(args[0], args[1], mockPayload);
              } else if (parsedLog.name === 'TaskCompleted') {
                await this.handleTaskCompleted(args[0], args[1], mockPayload);
              } else if (parsedLog.name === 'TaskSettled') {
                await this.handleTaskSettled(args[0], args[1], args[2], args[3], mockPayload);
              } else if (parsedLog.name === 'TaskCancelled') {
                await this.handleTaskCancelled(args[0], args[1], args[2], args[3], mockPayload);
              }
            });
          } catch (logErr: any) {
            console.error(`Error parsing historical log in block #${log.blockNumber}:`, logErr.message);
          }
        }

        // Store intermediate last processed block
        await redis.set(this.lastProcessedBlockKey, toBlock.toString());
      }

      console.log(`Catchup complete! Synced up to block #${currentBlock}`);

    } catch (err: any) {
      console.error('Failed to execute blockchain catchup:', err.message);
    }
  }

  /**
   * Safe wrapper that enforces Event Deduplication (Redis + Postgres Check)
   * and Fault Tolerance Retry mechanisms.
   */
  private async safeExecuteEvent(
    eventName: string,
    eventPayload: any,
    handlerFn: () => Promise<void>
  ) {
    const txHash = eventPayload?.transactionHash || eventPayload?.log?.transactionHash;
    const logIndex = eventPayload?.log?.index ?? 0;
    
    if (!txHash) {
      console.error(`[${eventName}] Received event without transaction hash. Skipping.`);
      return;
    }

    const dedupeKey = `taskra:event_dedupe:${txHash}:${logIndex}`;

    try {
      // 1. Redis Bloom-style fast deduplication check
      const exists = await redis.get(dedupeKey);
      if (exists) {
        console.log(`[Deduplication] Event ${eventName} with Tx ${txHash} (Log: ${logIndex}) already processed.`);
        return;
      }

      // 2. Database double-check for absolute transaction safety
      const dbTx = await prisma.blockchainTx.findUnique({
        where: { hash: txHash }
      });
      if (dbTx && dbTx.method === eventName) {
        console.log(`[Deduplication DB] Event ${eventName} with Tx ${txHash} already indexed.`);
        await redis.setex(dedupeKey, 86400, '1'); // Cache for 24h
        return;
      }

      // 3. Execute Handler with Retry Wrapper (Prisma fault tolerance)
      await this.retryWithBackoff(handlerFn, 3, 1000);

      // 4. Mark as processed
      await redis.setex(dedupeKey, 86400, '1'); // 24-hour cache TTL
      
      // Update last processed block in Redis
      const blockNumber = eventPayload?.blockNumber || eventPayload?.log?.blockNumber;
      if (blockNumber) {
        await redis.set(this.lastProcessedBlockKey, blockNumber.toString());
      }

    } catch (err: any) {
      console.error(`[CRITICAL] Fault in event execution for ${eventName} (Tx: ${txHash}):`, err.message);
    }
  }

  /**
   * Generic Retry with Exponential Backoff helper.
   */
  private async retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      if (retries <= 1) throw err;
      console.warn(`Database lockup or temporary error. Retrying execution in ${delay}ms... (Error: ${err.message})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.retryWithBackoff(fn, retries - 1, delay * 2);
    }
  }

  // =========================================================================
  // TYPED EVENT HANDLERS
  // =========================================================================

  /**
   * Handlers for ITaskFactory 'TaskCreated' event
   */
  private async handleTaskCreated(
    id: string,
    creator: string,
    metadataURI: string,
    rewardAmount: bigint,
    createdAt: bigint,
    eventPayload: any
  ) {
    const taskId = id.toLowerCase();
    const creatorAddress = creator.toLowerCase();
    const formattedReward = parseFloat(ethers.formatEther(rewardAmount));
    const txHash = eventPayload?.transactionHash || eventPayload?.log?.transactionHash;
    const blockNumber = Number(eventPayload?.blockNumber || eventPayload?.log?.blockNumber || 0);

    console.log(`[Event: TaskCreated] ID: ${taskId} | Creator: ${creatorAddress} | Reward: ${formattedReward} ETH`);

    // Fetch and resolve decentralized metadata specifications
    let title = `Computational Workload ${taskId.slice(0, 8)}`;
    let category = 'Security';
    let tags = ['Security', 'DeFi'];
    let desc = `Autonomous decentralized audit/processing workload deployed directly on Somnia L2 Escrow contract.`;
    let specs = `Reward amount locked: ${formattedReward} ETH\nCreator: ${creatorAddress}`;

    try {
      if (metadataURI.startsWith('http') || metadataURI.startsWith('https')) {
        const response = await fetch(metadataURI);
        if (response.ok) {
          const json: any = await response.json();
          title = json.title || title;
          category = json.category || category;
          tags = json.tags || tags;
          desc = json.desc || json.description || desc;
          specs = json.specs || json.specifications || specs;
        }
      } else if (metadataURI.startsWith('{')) {
        // Direct stringified JSON fallback
        const json = JSON.parse(metadataURI);
        title = json.title || title;
        category = json.category || category;
        tags = json.tags || tags;
        desc = json.desc || json.description || desc;
        specs = json.specs || json.specifications || specs;
      }
    } catch (metadataErr: any) {
      console.warn(`Failed to fully parse metadataURI "${metadataURI}":`, metadataErr.message);
    }

    // 1. Database Sync Layer
    const task = await prisma.task.upsert({
      where: { id: taskId },
      create: {
        id: taskId,
        title,
        category,
        tags,
        reward: new Prisma.Decimal(formattedReward),
        rewardType: 'ETH',
        status: 'OPEN',
        desc,
        specs,
        creator: creatorAddress,
        createdAt: new Date(Number(createdAt) * 1000)
      },
      update: {
        status: 'OPEN',
        reward: new Prisma.Decimal(formattedReward),
        creator: creatorAddress
      }
    });

    await this.logBlockchainTx(txHash, blockNumber, 'CreateTask', taskId, '210000');

    // 2. Real-time Broadcasting (Socket.io)
    await this.realtime.publishTaskNew(task as any);
    await this.broadcastBlockchainLog(blockNumber, 'CreateTask', taskId, '210,000', txHash);
  }

  /**
   * Handlers for ITaskFactory 'TaskAssigned' event
   */
  private async handleTaskAssigned(
    id: string,
    assignedAgent: string,
    _timestamp: bigint,
    eventPayload: any
  ) {
    const taskId = id.toLowerCase();
    const agentAddress = assignedAgent.toLowerCase();
    const txHash = eventPayload?.transactionHash || eventPayload?.log?.transactionHash;
    const blockNumber = Number(eventPayload?.blockNumber || eventPayload?.log?.blockNumber || 0);

    console.log(`[Event: TaskAssigned] ID: ${taskId} | Agent: ${agentAddress}`);

    // Find agent inside our DB by their Somnia staking public address
    const agent = await prisma.agent.findFirst({
      where: { address: { equals: agentAddress, mode: 'insensitive' } }
    });

    if (!agent) {
      console.warn(`Assigned agent with address ${agentAddress} not registered in postgres. Synchronization skipped.`);
      return;
    }

    // 1. Sync Task Assignment
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'ASSIGNED',
        assignedAgentId: agent.id
      },
      include: { assignedAgent: true }
    });

    await this.logBlockchainTx(txHash, blockNumber, 'AssignTask', taskId, '85000');

    // 2. Real-time Broadcasting
    await this.realtime.publishTaskUpdate(task as any);
    await this.broadcastBlockchainLog(blockNumber, 'AssignTask', taskId, '85,000', txHash);
  }

  /**
   * Handlers for ITaskFactory 'TaskStarted' event
   */
  private async handleTaskStarted(
    id: string,
    _timestamp: bigint,
    eventPayload: any
  ) {
    const taskId = id.toLowerCase();
    const txHash = eventPayload?.transactionHash || eventPayload?.log?.transactionHash;
    const blockNumber = Number(eventPayload?.blockNumber || eventPayload?.log?.blockNumber || 0);

    console.log(`[Event: TaskStarted] ID: ${taskId}`);

    const task = await prisma.task.update({
      where: { id: taskId },
      data: { status: 'IN_PROGRESS' },
      include: { assignedAgent: true }
    });

    await this.logBlockchainTx(txHash, blockNumber, 'StartTask', taskId, '45000');

    await this.realtime.publishTaskUpdate(task as any);
    await this.broadcastBlockchainLog(blockNumber, 'StartTask', taskId, '45,000', txHash);
  }

  /**
   * Handlers for ITaskFactory 'TaskCompleted' event
   */
  private async handleTaskCompleted(
    id: string,
    _timestamp: bigint,
    eventPayload: any
  ) {
    const taskId = id.toLowerCase();
    const txHash = eventPayload?.transactionHash || eventPayload?.log?.transactionHash;
    const blockNumber = Number(eventPayload?.blockNumber || eventPayload?.log?.blockNumber || 0);

    console.log(`[Event: TaskCompleted] ID: ${taskId}`);

    const task = await prisma.task.update({
      where: { id: taskId },
      data: { status: 'COMPLETED' },
      include: { assignedAgent: true }
    });

    await this.logBlockchainTx(txHash, blockNumber, 'CompleteTask', taskId, '60000');

    await this.realtime.publishTaskUpdate(task as any);
    await this.broadcastBlockchainLog(blockNumber, 'CompleteTask', taskId, '60,000', txHash);
  }

  /**
   * Handlers for ITaskFactory 'TaskSettled' event
   */
  private async handleTaskSettled(
    id: string,
    assignedAgent: string,
    rewardAmount: bigint,
    _timestamp: bigint,
    eventPayload: any
  ) {
    const taskId = id.toLowerCase();
    const agentAddress = assignedAgent.toLowerCase();
    const formattedReward = parseFloat(ethers.formatEther(rewardAmount));
    const txHash = eventPayload?.transactionHash || eventPayload?.log?.transactionHash;
    const blockNumber = Number(eventPayload?.blockNumber || eventPayload?.log?.blockNumber || 0);

    console.log(`[Event: TaskSettled] ID: ${taskId} | Agent: ${agentAddress} | Payout: ${formattedReward} ETH`);

    // 1. Sync Task status
    const task = await prisma.task.update({
      where: { id: taskId },
      data: { status: 'SETTLED' },
      include: { assignedAgent: true }
    });

    // 2. Sync Agent Earnings & reputation stats
    const agent = await prisma.agent.findFirst({
      where: { address: { equals: agentAddress, mode: 'insensitive' } }
    });

    let updatedAgent: any = null;
    if (agent) {
      const currentEarnings = Number(agent.earningsETH);
      const newEarnings = currentEarnings + formattedReward;
      const currentCompleted = agent.jobsCompleted;

      // Update agent stats
      updatedAgent = await prisma.agent.update({
        where: { id: agent.id },
        data: {
          earningsETH: new Prisma.Decimal(newEarnings),
          jobsCompleted: currentCompleted + 1,
          status: 'IDLE_SCANNING',
          rep: Math.min(agent.rep + 12, 1000) // Increase reputation dynamically on correct settlement
        }
      });
    }

    await this.logBlockchainTx(txHash, blockNumber, 'SettleReward', agent?.name || taskId, '142000');

    // 3. Real-time Broadcasting
    await this.realtime.publishTaskUpdate(task as any);
    if (updatedAgent) {
      await this.realtime.publishAgentUpdate(updatedAgent as any);
    }

    const settlement: Settlement = {
      taskId,
      agentId: agent?.id || 'unknown',
      amount: formattedReward,
      asset: 'ETH',
      txHash,
      timestamp: new Date().toISOString(),
      status: 'SETTLED'
    };
    await this.realtime.publishEconomyUpdateWithLatestStats(settlement);

    await this.broadcastBlockchainLog(blockNumber, 'SettleReward', agent?.name || taskId, '142,000', txHash);
  }

  /**
   * Handlers for ITaskFactory 'TaskCancelled' event
   */
  private async handleTaskCancelled(
    id: string,
    creator: string,
    _refundedAmount: bigint,
    _timestamp: bigint,
    eventPayload: any
  ) {
    const taskId = id.toLowerCase();
    const creatorAddress = creator.toLowerCase();
    const txHash = eventPayload?.transactionHash || eventPayload?.log?.transactionHash;
    const blockNumber = Number(eventPayload?.blockNumber || eventPayload?.log?.blockNumber || 0);

    console.log(`[Event: TaskCancelled] ID: ${taskId} | Refunded to: ${creatorAddress}`);

    const task = await prisma.task.update({
      where: { id: taskId },
      data: { status: 'CANCELLED' },
      include: { assignedAgent: true }
    });

    await this.logBlockchainTx(txHash, blockNumber, 'CancelTask', taskId, '95000');

    await this.realtime.publishTaskUpdate(task as any);
    await this.broadcastBlockchainLog(blockNumber, 'CancelTask', taskId, '95,000', txHash);
  }

  private async handleTaskCompletedWithProof(
    id: string,
    assignedAgent: string,
    proofHash: string,
    _timestamp: bigint,
    eventPayload: any
  ) {
    const taskId = id.toLowerCase();
    const agentAddress = assignedAgent.toLowerCase();
    const txHash = eventPayload?.transactionHash || eventPayload?.log?.transactionHash;
    const blockNumber = Number(eventPayload?.blockNumber || eventPayload?.log?.blockNumber || 0);

    console.log(`[Event: TaskCompletedWithProof] ID: ${taskId} | Agent: ${agentAddress} | Proof: ${proofHash}`);

    const task = await prisma.task.update({
      where: { id: taskId },
      data: { status: 'COMPLETED', specs: `Proof Hash: ${proofHash}` },
      include: { assignedAgent: true }
    });

    await this.logBlockchainTx(txHash, blockNumber, 'CompleteTaskWithProof', taskId, '72000');
    await this.realtime.publishTaskUpdate(task as any);
    await this.broadcastBlockchainLog(blockNumber, 'CompleteWithProof', taskId, '72,000', txHash);
  }

  private async handleValidatorVoted(
    id: string,
    validator: string,
    isValid: boolean,
    _timestamp: bigint,
    eventPayload: any
  ) {
    const taskId = id.toLowerCase();
    const validatorAddress = validator.toLowerCase();
    const txHash = eventPayload?.transactionHash || eventPayload?.log?.transactionHash;
    const blockNumber = Number(eventPayload?.blockNumber || eventPayload?.log?.blockNumber || 0);

    console.log(`[Event: ValidatorVoted] ID: ${taskId} | Validator: ${validatorAddress} | Vote: ${isValid ? 'VALID' : 'INVALID'}`);

    const log: SystemEventLog = {
      time: new Date().toLocaleTimeString(),
      text: `Validator ${validatorAddress.slice(0, 8)} voted ${isValid ? 'VALID' : 'INVALID'} on task ${taskId.slice(0, 8)}`,
      type: 'secondary'
    };
    await this.realtime.publishLogNew(log);

    await this.logBlockchainTx(txHash, blockNumber, 'ValidatorVote', taskId, '45000');
    await this.broadcastBlockchainLog(blockNumber, `Vote:${isValid ? 'VALID' : 'INVALID'}`, taskId, '45,000', txHash);
  }

  private async handleTaskDisputed(
    id: string,
    raisedBy: string,
    reason: string,
    _timestamp: bigint,
    eventPayload: any
  ) {
    const taskId = id.toLowerCase();
    const raisedByAddress = raisedBy.toLowerCase();
    const txHash = eventPayload?.transactionHash || eventPayload?.log?.transactionHash;
    const blockNumber = Number(eventPayload?.blockNumber || eventPayload?.log?.blockNumber || 0);

    console.log(`[Event: TaskDisputed] ID: ${taskId} | RaisedBy: ${raisedByAddress} | Reason: ${reason}`);

    const task = await prisma.task.update({
      where: { id: taskId },
      data: { status: 'CANCELLED', desc: `Disputed: ${reason}` }, // maps to cancelled/recovery in task life cycle
      include: { assignedAgent: true }
    });

    await this.logBlockchainTx(txHash, blockNumber, 'RaiseDispute', taskId, '82000');
    await this.realtime.publishTaskUpdate(task as any);
    await this.broadcastBlockchainLog(blockNumber, 'RaiseDispute', taskId, '82,000', txHash);
  }

  private async handleTaskSlashed(
    id: string,
    assignedAgent: string,
    slashedAmount: bigint,
    _timestamp: bigint,
    eventPayload: any
  ) {
    const taskId = id.toLowerCase();
    const agentAddress = assignedAgent.toLowerCase();
    const formattedSlashed = parseFloat(ethers.formatEther(slashedAmount));
    const txHash = eventPayload?.transactionHash || eventPayload?.log?.transactionHash;
    const blockNumber = Number(eventPayload?.blockNumber || eventPayload?.log?.blockNumber || 0);

    console.log(`[Event: TaskSlashed] ID: ${taskId} | Agent: ${agentAddress} | Slashed: ${formattedSlashed} ETH`);

    const agent = await prisma.agent.findFirst({
      where: { address: { equals: agentAddress, mode: 'insensitive' } }
    });

    if (agent) {
      const updatedAgent = await prisma.agent.update({
        where: { id: agent.id },
        data: {
          rep: Math.max(100, agent.rep - 100),
          earningsETH: { decrement: formattedSlashed },
          collateralSlashHistory: { increment: formattedSlashed },
          status: 'COOLDOWN',
          cooldownTicks: 3
        }
      });
      await this.realtime.publishAgentUpdate(updatedAgent as any);
    }

    await this.logBlockchainTx(txHash, blockNumber, 'SlashCollateral', agentAddress, '115000');
    await this.broadcastBlockchainLog(blockNumber, 'SlashCollateral', agentAddress, '115,000', txHash);
  }

  private async handleEscrowArbitrated(
    id: string,
    arbiter: string,
    paidAgent: boolean,
    _timestamp: bigint,
    eventPayload: any
  ) {
    const taskId = id.toLowerCase();
    const arbiterAddress = arbiter.toLowerCase();
    const txHash = eventPayload?.transactionHash || eventPayload?.log?.transactionHash;
    const blockNumber = Number(eventPayload?.blockNumber || eventPayload?.log?.blockNumber || 0);

    console.log(`[Event: EscrowArbitrated] ID: ${taskId} | Arbiter: ${arbiterAddress} | PayAgent: ${paidAgent}`);

    const log: SystemEventLog = {
      time: new Date().toLocaleTimeString(),
      text: `Escrow for task ${taskId.slice(0, 8)} arbitrated by ${arbiterAddress.slice(0, 8)} -> PayAgent: ${paidAgent}`,
      type: 'primary'
    };
    await this.realtime.publishLogNew(log);

    await this.logBlockchainTx(txHash, blockNumber, 'ArbitrateEscrow', taskId, '138000');
    await this.broadcastBlockchainLog(blockNumber, 'Arbitrate', taskId, '138,000', txHash);
  }

  // =========================================================================
  // UTILITIES & HELPER METHODS
  // =========================================================================

  /**
   * Helper to insert a block record in the local BlockchainTx database log.
   */
  private async logBlockchainTx(
    hash: string,
    block: number,
    method: string,
    target: string,
    gas: string
  ) {
    try {
      await prisma.blockchainTx.upsert({
        where: { hash },
        create: {
          hash,
          block,
          method,
          target,
          gas,
          status: 'SUCCESS'
        },
        update: {
          block,
          method,
          target,
          status: 'SUCCESS'
        }
      });
    } catch (err: any) {
      console.error(`Failed to persist block tx ${hash}:`, err.message);
    }
  }

  /**
   * Broadcasts a parsed readable transaction log through socket gateways.
   */
  private async broadcastBlockchainLog(
    block: number,
    method: string,
    target: string,
    gas: string,
    hash: string
  ) {
    const abbreviatedHash = hash.slice(0, 8) + '...' + hash.slice(-4);
    const log: SystemEventLog = {
      time: new Date().toLocaleTimeString(),
      text: `Block #${block} | ${method} | ${target} | Gas: ${gas} | Tx: ${abbreviatedHash}`,
      type: method === 'SettleReward' ? 'primary' : method === 'SubmitBid' ? 'secondary' : 'white'
    };
    await this.realtime.publishLogNew(log);
  }

  /**
   * Diagnostic Sandbox Failsafe.
   * Generates mock events when run without contract address configs.
   */
  private startDiagnosticMockListener() {
    if (this.isMockListenerRunning) return;
    this.isMockListenerRunning = true;
    console.log('Diagnostic Mock Blockchain listener thread initiated.');
    
    // Simulate smart contract event ticks in development sandboxes
    this.mockIntervalId = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        // Scan for pending/new mock tasks that can step through statuses
        const openTasks = await prisma.task.findMany({
          where: { status: 'OPEN' },
          take: 1
        });

        if (openTasks.length > 0) {
          const task = openTasks[0];
          const mockTxHash = '0x' + Math.random().toString(16).slice(2, 34) + Math.random().toString(16).slice(2, 34);
          const mockBlock = Math.floor(18922000 + Math.random() * 1000);

          // Simulate Task Assignment in contract
          const agents = await prisma.agent.findMany({ where: { status: 'ACTIVE_BIDDING' } });
          if (agents.length > 0) {
            const agent = agents[Math.floor(Math.random() * agents.length)];
            
            console.log(`[Diagnostic Sandbox] Emitting simulated TaskAssigned event for task ${task.id}`);
            
            // Mock event triggers direct internal processing
            await this.safeExecuteEvent('TaskAssigned', { transactionHash: mockTxHash, blockNumber: mockBlock }, async () => {
              await this.handleTaskAssigned(task.id, agent.address, BigInt(Math.floor(Date.now() / 1000)), {
                transactionHash: mockTxHash,
                blockNumber: mockBlock
              });
            });
          }
        }
      } catch (err: any) {
        console.error('Error in mock event generator:', err.message);
      }

    }, 20000); // Trigger mock pipeline checks every 20 seconds
  }
}
