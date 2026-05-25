import { prisma } from '../config/database';
import { RealtimeService } from './realtime';
import { SignalEngine } from './signalEngine';
import { DecisionEngine, AdaptiveBehaviorModel } from './agentEngine';
import { ReasoningEngine } from './reasoningEngine';
import { MemoryStore } from './memoryEngine';
import { ChaosEngine } from './chaosEngine';
import { CoalitionEngine } from './coalitionEngine';

export interface SimulationState {
  isActive: boolean;
  tickCount: number;
  intervalId: NodeJS.Timeout | null;
  speedMs: number;
}

export class AutonomousSimulationEngine {
  private static state: SimulationState = {
    isActive: false,
    tickCount: 0,
    intervalId: null,
    speedMs: 8000,
  };

  private static realtime: RealtimeService | null = null;

  /** Bind the typed RealtimeService instance (called once at startup) */
  public static init(realtimeService: RealtimeService) {
    this.realtime = realtimeService;
  }

  public static getState() {
    return {
      isActive: this.state.isActive,
      tickCount: this.state.tickCount,
      speedMs: this.state.speedMs,
    };
  }

  /** Toggle simulation on/off. */
  public static toggle(active?: boolean) {
    const targetState = active !== undefined ? active : !this.state.isActive;

    if (targetState === this.state.isActive) {
      return this.getState();
    }

    this.state.isActive = targetState;

    if (this.state.isActive) {
      this.startLoop();
      this.emitLog('SUCCESS', 'Autonomous Simulation Engine started — competitive digital economy is live.');
    } else {
      this.stopLoop();
      this.emitLog('WARNING', 'Autonomous Simulation Engine paused. Observer mode locked.');
    }

    return this.getState();
  }

  public static setSpeed(speedMs: number) {
    this.state.speedMs = speedMs;
    if (this.state.isActive) {
      this.startLoop();
    }
    this.emitLog('SUCCESS', `⚙️ [Control] Simulation speed threshold set to ${speedMs}ms interval.`);
    return this.getState();
  }

  public static async triggerChaosEvent(type: string) {
    if (!this.realtime) return { success: false };
    
    let logText = '';
    let logType: 'white' | 'primary' | 'secondary' | 'error' | 'success' = 'white';

    if (type === 'MARKET_CRASH') {
      logText = '🚨 [CHAOS EVENT] Dynamic DeFi Reward yields drop by 50% across active nodes due to structural liquidity shock!';
      logType = 'error';
      await prisma.task.updateMany({
        where: { status: 'OPEN' },
        data: { reward: { multiply: 0.5 } }
      });
    } else if (type === 'GAS_SPIKE') {
      logText = '⛽ [CHAOS EVENT] Network Congestion Spike! Gas caps inflated by 300%. High-risk defensive bidding premiums active.';
      logType = 'secondary';
    } else if (type === 'SECURITY_BREACH') {
      logText = '⚠️ [CHAOS EVENT] Security Vulnerability detected in Smart Contract compiler! New high-urgency audit jobs evolutionary cascade initiated.';
      logType = 'error';
      const auditTask = await prisma.task.create({
        data: {
          title: '[CHAOS] Emergency Codebase Security Audit',
          category: 'Security',
          tags: ['security', 'contract', 'audit'],
          reward: 3.50,
          rewardType: 'ETH',
          status: 'OPEN',
          desc: 'Urgent security breach mitigation task triggered by administrative override. Comprehensive access control tracing required.',
          specs: 'Target: Admin contract. Action: Check owner authorization modifiers, trace reentrancy pathways, verify withdrawal restrictions.',
          creator: '0xAdministrativeControlCenter',
          evolutionDepth: 0,
          whyCreated: 'Administrative override: deployed under state security breach chaos injection.',
          urgencyScore: 99,
          economicImportance: 'CRITICAL',
          confidenceScore: 0.99
        }
      });
      await this.realtime.publishTaskNew(auditTask as any);
    } else if (type === 'VALIDATOR_DISAGREEMENT') {
      logText = '⚔️ [CHAOS EVENT] Validator Consensus Disagreement! Consensus split, next validation run has a 75% execution slash margin.';
      logType = 'primary';
    }

    this.emitLog(logType.toUpperCase() as any, logText);
    return { success: true, text: logText };
  }

  private static startLoop() {
    if (this.state.intervalId) clearInterval(this.state.intervalId);
    this.state.intervalId = setInterval(() => { this.tick(); }, this.state.speedMs);
  }

  private static stopLoop() {
    if (this.state.intervalId) {
      clearInterval(this.state.intervalId);
      this.state.intervalId = null;
    }
  }

  /** Run one simulation step immediately */
  public static async tick() {
    this.state.tickCount++;
    try {
      if (!this.realtime || !this.state.isActive) return;

      // 0. Apply dynamic market chaos & volatility
      await ChaosEngine.applyChaos(this.realtime);

      // 1. Decays, Cooldown Ticks decrement & bankrupt status checking
      await this.runCooldownAndTrustDecay();

      // 1.5 Cognitive Memory Pruning & decay
      if (this.state.tickCount % 5 === 0) {
        await MemoryStore.runMemoryPruning(this.realtime);
      }

      // 2. Expiration Verification
      await this.runTaskExpirationCheck();

      // 3. Main Step Execution
      const step = this.state.tickCount % 5;
      switch (step) {
        case 0: await this.simulateTaskGeneration(); break;
        case 1: await this.simulateAgentBidding();   break;
        case 2: await this.simulateTaskExecution();  break;
        case 3: await this.simulateConsensusValidation(); break;
        case 4: await this.simulateBlockchainSettlement(); break;
      }

      // Coalition Engine: attempt formation on open tasks + tick existing coalitions
      await this.runCoalitionCycle();

      // 4. Aggregate & Record economy metrics
      await this.recordAndBroadcastEconomyMetrics();
    } catch (err: any) {
      console.error('[SimulationEngine] Tick error:', err.message);
      this.emitLog('ERROR', `Simulation loop crashed: ${err.message}`);
    }
  }

  // ── Cooldown & Trust Decay Engine ─────────────────────────────────────────

  private static async runCooldownAndTrustDecay() {
    const agents = await prisma.agent.findMany();
    for (const agent of agents) {
      let status = agent.status;
      let cooldown = agent.cooldownTicks;
      let rep = agent.rep;

      // Bankruptcy Check
      const totalEarnings = Number(agent.earningsETH) + Number(agent.earningsUSDC);
      if (rep < 150 || totalEarnings < 0) {
        if (status !== 'BANKRUPT') {
          status = 'BANKRUPT';
          this.emitLog('ERROR', `🚨 [Bankruptcy] Agent ${agent.name} has entered bankruptcy due to critical reputation decay or negative earnings!`);
          await prisma.agent.update({
            where: { id: agent.id },
            data: { status },
          });
          if (this.realtime) {
            await this.realtime.publishAgentUpdate(await prisma.agent.findUnique({ where: { id: agent.id } }) as any);
            await ChaosEngine.triggerBlockchainDisruptEvent('BANKRUPTCY', this.realtime!);
          }
        }
        continue;
      }

      // Cooldown decrement
      if (status === 'COOLDOWN' && cooldown > 0) {
        cooldown--;
        if (cooldown === 0) {
          status = 'IDLE_SCANNING';
          this.emitLog('INFO', `❄️ [Penalty] Agent ${agent.name} has finished cooling down and is back in the scanning pool.`);
        }
        await prisma.agent.update({
          where: { id: agent.id },
          data: { cooldownTicks: cooldown, status },
        });
        if (this.realtime) this.realtime.publishAgentUpdate(await prisma.agent.findUnique({ where: { id: agent.id } }) as any);
        continue;
      }

      // Trust Decay for idle agents
      if (status === 'IDLE_SCANNING') {
        rep = Math.max(100, rep - 2); // 2 rep loss for idleness per tick
        await prisma.agent.update({
          where: { id: agent.id },
          data: { rep },
        });
        if (this.realtime) this.realtime.publishAgentUpdate(await prisma.agent.findUnique({ where: { id: agent.id } }) as any);
      }
    }
  }

  // ── Task Expiration & Recovery Engine ─────────────────────────────────────

  private static async runTaskExpirationCheck() {
    const expiredTasks = await prisma.task.findMany({
      where: {
        status: 'OPEN',
        expiresAt: { lt: new Date() },
      },
      include: { bids: true },
    });

    for (const task of expiredTasks) {
      await prisma.task.update({
        where: { id: task.id },
        data: { status: 'CANCELLED' },
      });
      this.emitLog('WARNING', `⏳ [Expiration] Task "${task.title}" (${task.id}) expired without assignment. Refunding collateral stake for bidders.`);

      // Refund bids collaterals
      for (const bid of task.bids) {
        await prisma.agent.update({
          where: { id: bid.agentId },
          data: {
            stakeLocked: { decrement: Number(bid.collateralLocked) },
          },
        });
      }

      if (this.realtime) {
        this.realtime.publishTaskUpdate(await prisma.task.findUnique({ where: { id: task.id } }) as any);
      }
    }
  }

  // ── Step 1: Autonomous Task Generation ────────────────────────────────────

  private static async simulateTaskGeneration() {
    if (!this.realtime) return;
    this.emitLog('INFO', '🌀 [SignalEngine] Analyzing system observability metrics...');
    
    const vol = await ChaosEngine.getVolatilityIndex();
    let numTasksToGenerate = 1;
    
    // Volatility surge event trigger
    if (vol > 65 && Math.random() < 0.45) {
      numTasksToGenerate = Math.floor(Math.random() * 2) + 2; // Generate 2-3 tasks!
      this.emitLog('ERROR', `⚡ [Market Chaos] Sudden Task Surge active! Volatility (${vol}%) triggers automated generation of ${numTasksToGenerate} tasks simultaneously.`);
    }

    for (let i = 0; i < numTasksToGenerate; i++) {
      const task = await SignalEngine.tick(this.realtime);
      if (task) {
        // Setup dynamic expiration metadata (lasts ~15 ticks)
        const expiresAt = new Date(Date.now() + 15 * this.state.speedMs);
        
        // Dynamic reward fluctuations based on chaos!
        const baseReward = Number(task.reward);
        const fluctuatedReward = await ChaosEngine.getModifiedReward(baseReward);
        
        const updated = await prisma.task.update({
          where: { id: task.id },
          data: { 
            expiresAt,
            reward: fluctuatedReward,
            whyCreated: task.whyCreated + ` [Economic Volatility applied. Base: ${baseReward} -> Fluctuated: ${fluctuatedReward}]`
          },
        });
        this.emitLog('SUCCESS', `🎉 [SignalEngine] Generated signal-driven task: "${updated.title}" [${updated.id}] (Expires in 15 ticks, Reward: ${fluctuatedReward} ${updated.rewardType})`);
      } else if (i === 0) {
        this.emitLog('WARNING', '🔍 [SignalEngine] Observability scan completed: system within healthy baselines.');
      }
    }
  }

  // ── Step 2: Autonomous Agent Bidding ──────────────────────────────────────

  private static async simulateAgentBidding() {
    if (!this.realtime) return;
    const openTasks = await prisma.task.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    });

    if (openTasks.length === 0) {
      this.emitLog('WARNING', '[Auction] Bidding cycle skipped: no open jobs available.');
      return;
    }

    // Process all open tasks to generate multiple competing bids!
    for (const targetTask of openTasks.slice(0, 2)) {
      const eligibleAgents = await prisma.agent.findMany({
        where: {
          status: { in: ['IDLE_SCANNING', 'ACTIVE_BIDDING'] },
        },
      });

      if (eligibleAgents.length === 0) continue;

      // Select up to 3 candidate agents to compete
      const candidates = eligibleAgents.sort(() => 0.5 - Math.random()).slice(0, 3);

      for (const biddingAgent of candidates) {
        // Collateral lock check (10% of task reward)
        const collateralRequired = Number(targetTask.reward) * 0.1;
        const agentBalance = Number(biddingAgent.earningsETH) + Number(biddingAgent.earningsUSDC);
        
        if (agentBalance < collateralRequired) {
          this.emitLog('INFO', `⚖️ [Auction] ${biddingAgent.name} skipped bidding. Reason: Insufficient balance for collateral lock.`);
          continue;
        }

        // Avoid double bidding
        const existingBid = await prisma.bid.findUnique({
          where: {
            taskId_agentId: { taskId: targetTask.id, agentId: biddingAgent.id },
          },
        });
        if (existingBid) continue;

        // Evaluate bid
        const evaluation = await DecisionEngine.evaluateBidding(biddingAgent, targetTask);

        if (!evaluation.shouldBid) {
          this.emitLog('INFO', `⚖️ [Auction] ${biddingAgent.name} declined bidding on ${targetTask.id}. Reason: ${evaluation.reason}`);
          await ReasoningEngine.trace({
            agentId: biddingAgent.id,
            agentName: biddingAgent.name,
            specialty: biddingAgent.specialty,
            action: 'SKIPPING',
            taskId: targetTask.id,
            taskTitle: targetTask.title,
            profitability: evaluation.yield || 0.8,
            confidence: evaluation.confidence || 0.4,
            compatibility: evaluation.compatibility || 0.2,
            successRate: (biddingAgent.winRate || 80) / 100,
            riskScore: evaluation.riskScore || 0.5,
            realtime: this.realtime,
            emotions: evaluation.emotions,
          });
          continue;
        }

        const bidAmount = evaluation.bidAmount!;
        const bidId = `BD-${Math.floor(Math.random() * 9000 + 1000)}`;

        // Lock Collateral: increment agent stakeLocked
        await prisma.agent.update({
          where: { id: biddingAgent.id },
          data: { stakeLocked: { increment: collateralRequired } },
        });

        // Create bid record
        await prisma.bid.create({
          data: {
            id: bidId,
            taskId: targetTask.id,
            agentId: biddingAgent.id,
            bidAmount,
            collateralLocked: collateralRequired,
            status: 'PENDING',
          },
        });

        const updatedTask = await prisma.task.update({
          where: { id: targetTask.id },
          data: { bidsCount: { increment: 1 } },
        });

        await this.realtime.publishTaskUpdate(updatedTask as any);
        this.emitLog('SUCCESS', `🤝 [Auction] Bid placed: ${biddingAgent.name} bids ${bidAmount} ${targetTask.rewardType} on task ${targetTask.id} (Collateral Locked: ${collateralRequired.toFixed(4)})`);

        // Trace Bidding Reasoning with emotional metrics
        await ReasoningEngine.trace({
          agentId: biddingAgent.id,
          agentName: biddingAgent.name,
          specialty: biddingAgent.specialty,
          action: 'BIDDING',
          taskId: targetTask.id,
          taskTitle: targetTask.title,
          profitability: evaluation.yield || 1.2,
          confidence: evaluation.confidence || 0.85,
          compatibility: evaluation.compatibility || 0.9,
          successRate: (biddingAgent.winRate || 80) / 100,
          riskScore: evaluation.riskScore || 0.2,
          realtime: this.realtime,
          emotions: evaluation.emotions,
        });

        // Trigger Competition/Rivalry Trace with emotional pressure
        if (updatedTask.bidsCount > 1) {
          await ReasoningEngine.trace({
            agentId: biddingAgent.id,
            agentName: biddingAgent.name,
            specialty: biddingAgent.specialty,
            action: 'COMPETING',
            taskId: targetTask.id,
            taskTitle: targetTask.title,
            profitability: evaluation.yield || 1.2,
            confidence: evaluation.confidence || 0.85,
            compatibility: evaluation.compatibility || 0.9,
            successRate: (biddingAgent.winRate || 80) / 100,
            riskScore: evaluation.riskScore || 0.2,
            realtime: this.realtime,
            emotions: evaluation.emotions ? {
              ...evaluation.emotions,
              stress: Math.min(100, evaluation.emotions.stress + 15), // rival bid pushes stress higher!
            } : undefined,
          });
        }
      }
    }
  }

  // ── Step 3: Stake- and Reputation-Weighted Auction Assignment ─────────────

  private static async simulateTaskExecution() {
    const openTasks = await prisma.task.findMany({
      where: { status: 'OPEN' },
      include: { bids: { include: { agent: true } } },
    });

    const tasksWithBids = openTasks.filter(t => t.bids.length > 0);

    if (tasksWithBids.length === 0) {
      this.emitLog('WARNING', '[WorkEngine] Execution cycle skipped: no active auctions with bidding candidates.');
      return;
    }

    // Process highest priority task
    const targetTask = tasksWithBids[0];

    // Compute scores for each bidder: Score = rep * 0.4 + winRate * 0.3 + bidAmount * 0.1 + stakeLocked * 0.2
    let bestBid = targetTask.bids[0];
    let bestScore = -1;

    for (const bid of targetTask.bids) {
      const agent = bid.agent;
      const score = (agent.rep * 0.4) + (agent.winRate * 0.3) + (Number(bid.bidAmount) * 0.1) + (Number(agent.stakeLocked) * 0.2);
      if (score > bestScore) {
        bestScore = score;
        bestBid = bid;
      }
    }

    // Award task to winning bid
    await prisma.bid.update({
      where: { id: bestBid.id },
      data: { status: 'ACCEPTED' },
    });

    // Reject other bids and REFUND their locked stakes
    const otherBids = targetTask.bids.filter(b => b.id !== bestBid.id);
    for (const rejectedBid of otherBids) {
      await prisma.bid.update({
        where: { id: rejectedBid.id },
        data: { status: 'REJECTED' },
      });
      await prisma.agent.update({
        where: { id: rejectedBid.agentId },
        data: { stakeLocked: { decrement: Number(rejectedBid.collateralLocked) } },
      });
    }

    // Set task to IN_PROGRESS
    const updatedTask = await prisma.task.update({
      where: { id: targetTask.id },
      data: { status: 'IN_PROGRESS', assignedAgentId: bestBid.agentId },
      include: { assignedAgent: true },
    });

    const updatedAgent = await prisma.agent.update({
      where: { id: bestBid.agentId },
      data: { status: 'ACTIVE_BIDDING' },
    });

    if (this.realtime) {
      await this.realtime.publishTaskUpdate(updatedTask as any);
      await this.realtime.publishAgentUpdate(updatedAgent as any);
    }
    
    this.emitLog('SUCCESS', `🎯 [Auction] Auction RESOLVED for ${updatedTask.id}. Winner: ${updatedAgent.name} (Reputation-Stake Score: ${bestScore.toFixed(2)}). Collateral of other bidders fully refunded.`);
  }

  // ── Step 4: Slashing Penalties & Failed Task Recovery ──────────────────────

  private static async simulateConsensusValidation() {
    if (!this.realtime) return;
    const runningTasks = await prisma.task.findMany({
      where: { status: 'IN_PROGRESS' },
      include: { assignedAgent: true, bids: true },
      orderBy: { updatedAt: 'asc' },
    });

    if (runningTasks.length === 0) {
      this.emitLog('WARNING', '[Consensus] Validation cycle skipped: no running executions.');
      return;
    }

    const activeTask = runningTasks[0];
    const winningBid = activeTask.bids.find(b => b.agentId === activeTask.assignedAgentId && b.status === 'ACCEPTED');
    const chaosDisagreementMod = await ChaosEngine.getValidatorDisagreementModifier();
    const failureThreshold = 0.85 - chaosDisagreementMod; // Higher volatility leads to higher validator strictness & execution failures!
    const executionFailed = Math.random() > failureThreshold;

    // Pick active validator agent
    const validatorNodes = await prisma.agent.findMany({
      where: { specialty: 'ValidatorAgent', status: { not: 'OFFLINE' } }
    });
    const validator = validatorNodes.length > 0
      ? validatorNodes[Math.floor(Math.random() * validatorNodes.length)]
      : null;
    const validatorName = validator ? validator.name : 'Consensus_Node_Alpha';

    if (!executionFailed) {
      // SUCCESSFUL execution
      const updatedTask = await prisma.task.update({
        where: { id: activeTask.id },
        data: { status: 'COMPLETED' },
      });
      
      // Release bid collateral: decrement stakeLocked
      if (winningBid) {
        await prisma.agent.update({
          where: { id: activeTask.assignedAgentId! },
          data: { stakeLocked: { decrement: Number(winningBid.collateralLocked) } },
        });
      }

      await this.realtime.publishTaskUpdate(updatedTask as any);
      this.emitLog('SUCCESS', `[Consensus] Approved submission for ${activeTask.id} by Validator ${validatorName}. Validation score: 98.42%`);

      if (activeTask.assignedAgentId && activeTask.assignedAgent) {
        await ReasoningEngine.trace({
          agentId: activeTask.assignedAgent.id,
          agentName: activeTask.assignedAgent.name,
          specialty: activeTask.assignedAgent.specialty,
          action: 'VALIDATING',
          taskId: activeTask.id,
          taskTitle: activeTask.title,
          profitability: 1.0,
          confidence: 0.95,
          compatibility: 1.0,
          successRate: (activeTask.assignedAgent.winRate || 80) / 100,
          riskScore: 0.1,
          reputationDelta: 12.0,
          realtime: this.realtime,
        });
        await AdaptiveBehaviorModel.handleTaskCompletion(activeTask.assignedAgentId, activeTask.id, 'SUCCESS', validatorName, this.realtime);
        
        // Orchestrate recursive task evolution cascade!
        const { TaskEvolutionEngine } = require('./taskEvolutionEngine');
        await TaskEvolutionEngine.processTaskEvolution(activeTask.id, 'SUCCESS', this.realtime);
      }
    } else {
      // SLASHING PENALTY & FAILED TASK RECOVERY
      const collateralToSlash = winningBid ? Number(winningBid.collateralLocked) : 0.1;
      const agent = activeTask.assignedAgent;

      this.emitLog('ERROR', `⚡ [PENALTY] Validator node ${validatorName} slashed Agent ${agent?.name || 'Agent'} on ${activeTask.id}! Slashing collateral stake (${collateralToSlash.toFixed(4)}) & decaying trust.`);

      if (activeTask.assignedAgentId && agent) {
        // Trigger event-driven market volatility shocks on slash
        await ChaosEngine.triggerBlockchainDisruptEvent('SLASH', this.realtime!);
        if (Math.random() < 0.40) {
          await ChaosEngine.triggerBlockchainDisruptEvent('DISPUTE', this.realtime!);
        }

        const usdcDeduct = activeTask.rewardType === 'USDC' ? collateralToSlash : 0;
        const ethDeduct  = activeTask.rewardType === 'ETH' ? collateralToSlash : 0;

        // Apply Slashes: deduct earnings, deduct reputation, lock in cooldown ticks
        const updatedAgent = await prisma.agent.update({
          where: { id: agent.id },
          data: {
            rep: Math.max(100, agent.rep - 100), // Loss of 100 reputation
            earningsETH: { decrement: ethDeduct },
            earningsUSDC: { decrement: usdcDeduct },
            stakeLocked: { decrement: collateralToSlash },
            collateralSlashHistory: { increment: collateralToSlash },
            status: 'COOLDOWN',
            cooldownTicks: 3, // Suspended for 3 ticks
          },
        });

        await this.realtime.publishAgentUpdate(updatedAgent as any);

        await ReasoningEngine.trace({
          agentId: agent.id,
          agentName: agent.name,
          specialty: agent.specialty,
          action: 'REJECTING',
          taskId: activeTask.id,
          taskTitle: activeTask.title,
          profitability: 0.0,
          confidence: 0.1,
          compatibility: 1.0,
          successRate: (agent.winRate || 80) / 100,
          riskScore: 0.95,
          reputationDelta: -100.0,
          realtime: this.realtime,
        });

        await AdaptiveBehaviorModel.handleTaskCompletion(agent.id, activeTask.id, 'SLASH', validatorName, this.realtime);

        // Orchestrate recursive task evolution cascade!
        const { TaskEvolutionEngine } = require('./taskEvolutionEngine');
        await TaskEvolutionEngine.processTaskEvolution(activeTask.id, 'SLASH', this.realtime);
      }

      // Failed Task Recovery: put back in OPEN status, dynamic reward boost (20% surge due to high execution demand)
      const currentReward = Number(activeTask.reward);
      const recoveredTask = await prisma.task.update({
        where: { id: activeTask.id },
        data: {
          status: 'OPEN',
          failedCount: { increment: 1 },
          reward: currentReward * 1.2, // Reward Fluctuations!
          assignedAgentId: null,
          bidsCount: 0,
        },
      });

      // Clear obsolete bids
      await prisma.bid.deleteMany({
        where: { taskId: activeTask.id },
      });

      await this.realtime.publishTaskUpdate(recoveredTask as any);
      this.emitLog('WARNING', `🔄 [Recovery] Recovered failed task ${activeTask.id} -> returned to auction pool with 20% surge incentive: ${(currentReward * 1.2).toFixed(4)} ${activeTask.rewardType}.`);
    }
  }

  // ── Step 5: Autonomous Blockchain Settlement ───────────────────────────────

  private static async simulateBlockchainSettlement() {
    const completedTasks = await prisma.task.findMany({
      where: { status: 'COMPLETED' },
      include: { assignedAgent: true },
      orderBy: { updatedAt: 'asc' },
    });

    if (completedTasks.length === 0) {
      this.emitLog('WARNING', '[Ledger] Settlement cycle skipped: no completed tasks pending payment.');
      return;
    }

    const task  = completedTasks[0];
    const agent = task.assignedAgent;
    if (!agent) return;

    const rewardVal  = Number(task.reward);
    const ethReward  = task.rewardType === 'ETH' ? rewardVal : 0;
    const usdcReward = task.rewardType === 'USDC' ? rewardVal : 0;

    const updatedAgent = await prisma.agent.update({
      where: { id: agent.id },
      data: {
        earningsETH:   { increment: ethReward },
        earningsUSDC:  { increment: usdcReward },
        jobsCompleted: { increment: 1 },
        rep:           Math.min(1000, agent.rep + 8),
        status:        'IDLE_SCANNING',
      },
    });

    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: { status: 'SETTLED' },
    });

    const txHash   = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const blockNum = 18922000 + this.state.tickCount;

    await prisma.blockchainTx.create({
      data: { hash: txHash, block: blockNum, method: 'SettleReward', target: agent.name, gas: '94,180', status: 'SUCCESS' },
    });

    if (this.realtime) {
      await this.realtime.publishTaskUpdate(updatedTask as any);
      await this.realtime.publishAgentUpdate(updatedAgent as any);
      await this.realtime.publishEconomyUpdateWithLatestStats({
        agentId:   agent.id,
        taskId:    task.id,
        amount:    rewardVal,
        asset:     task.rewardType as 'ETH' | 'USDC' | 'SOM',
        txHash,
        timestamp: new Date().toISOString(),
        status:    'SETTLED',
      });
    }

    this.emitLog('SUCCESS', `[Somnia] Settled block #${blockNum}. ${task.reward} ${task.rewardType} → ${agent.address}`);
  }

  // ── Economic Analytics Aggregator ──────────────────────────────────────────

  private static async recordAndBroadcastEconomyMetrics() {
    try {
      const agents = await prisma.agent.findMany();
      const openTasks = await prisma.task.findMany({ where: { status: 'OPEN' } });

      let totalStakes = 0;
      let totalSlashed = 0;
      let bankruptCount = 0;

      for (const agent of agents) {
        totalStakes += Number(agent.stakeLocked);
        totalSlashed += Number(agent.collateralSlashHistory);
        if (agent.status === 'BANKRUPT') bankruptCount++;
      }

      const failedTasksCount = await prisma.task.count({ where: { failedCount: { gt: 0 } } });
      const activeAuctions = openTasks.length;
      
      const avgRewardETH = openTasks.length > 0 
        ? openTasks.reduce((acc, t) => acc + (t.rewardType === 'ETH' ? Number(t.reward) : 0), 0) / openTasks.length
        : 0.0;

      const congestionIndex = activeAuctions * 0.15;

      await prisma.economyMetrics.create({
        data: {
          totalStakes,
          totalSlashed,
          bankruptCount,
          failedTasks: failedTasksCount,
          activeAuctions,
          avgRewardETH,
          congestionIndex,
        },
      });

      // Dispatch real-time statistics update via Socket Gateway
      if (this.realtime) {
        this.realtime.publishLogNew({
          time: new Date().toLocaleTimeString(),
          text: `📊 [Economy] Health: Congestion Index at ${congestionIndex.toFixed(2)} | Total Collateral Stakes locked: ${totalStakes.toFixed(4)} ETH | Active Auctions: ${activeAuctions}`,
          type: 'primary',
        });
      }
    } catch (err: any) {
      console.error('[SimulationEngine] Economy metrics aggregation failed:', err.message);
    }
  }

  private static emitLog(type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR', message: string) {
    if (!this.realtime) return;

    const logTypeMap: Record<string, 'primary' | 'secondary' | 'white' | 'error'> = {
      INFO: 'primary', SUCCESS: 'secondary', WARNING: 'white', ERROR: 'error',
    };

    this.realtime.publishLogNew({
      time: new Date().toLocaleTimeString(),
      text: message,
      type: logTypeMap[type],
    });
  }

  // ── Coalition Engine Integration ──────────────────────────────────────────

  private static async runCoalitionCycle() {
    if (!this.realtime) return;
    try {
      // 1. Attempt to form new coalitions on OPEN high-value tasks
      const openTasks = await prisma.task.findMany({
        where: { status: 'OPEN' },
        orderBy: { urgencyScore: 'desc' },
        take: 3,
      });

      const availableAgents = await prisma.agent.findMany({
        where: { status: { in: ['IDLE_SCANNING', 'ACTIVE_BIDDING'] } },
      });

      for (const task of openTasks) {
        await CoalitionEngine.attemptCoalitionFormation(task, availableAgents, this.realtime);
      }

      // 2. Advance all EXECUTING and CO_SIGNING coalitions
      await CoalitionEngine.tickCoalitions(this.realtime);

    } catch (err: any) {
      console.error('[CoalitionEngine] Coalition cycle error:', err.message);
    }
  }
}
