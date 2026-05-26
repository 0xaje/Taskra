import { prisma } from '../config/database';
import { RealtimeService } from './realtime';
import { taskQueue } from '../config/bullmq';
import { Task, TaskCategory, AssetType } from '@taskra/types';

export interface SystemMetricSnapshot {
  txCountLastHour: number;
  failedTxRate: number;
  avgGasPriceGwei: number;
  inactiveAgentsCount: number;
  highValueTransferEth: number;
  pendingTxCount: number;
  validatorDisagreementCount: number;
  lowRepAgentsCount: number;
  stuckTasksCount: number;
  maxBidsOnTask: number;
  poolLiquidityUsdc: number;
}

export interface DetectedSignal {
  type: string;
  value: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  urgencyScore: number; // 0 - 100
  confidenceScore: number; // 0.0 - 1.0
  description: string;
  metadata: Record<string, any>;
}

/**
 * 1. SIGNAL COLLECTOR SERVICE
 * Gathers on-chain metrics, system stats, agent states, and database logs,
 * injecting dynamic simulation variances to ensure the system is lively.
 */
export class SignalCollector {
  private static simFluctuationTick = 0;

  public static async collectMetrics(): Promise<SystemMetricSnapshot> {
    this.simFluctuationTick++;

    // A. Query actual database records
    const dbTxCount = await prisma.blockchainTx.count();
    const dbFailedTx = await prisma.blockchainTx.count({ where: { status: 'FAILURE' } });
    const dbAgents = await prisma.agent.findMany();
    const dbTasks = await prisma.task.findMany();

    // Calculate real stats from database
    const actualInactive = dbAgents.filter(a => a.status === 'OFFLINE').length;
    const actualLowRep = dbAgents.filter(a => a.rep < 500).length;
    const actualStuck = dbTasks.filter(t => t.status === 'IN_PROGRESS' && t.updatedAt < new Date(Date.now() - 30 * 60 * 1000)).length;
    
    let actualMaxBids = 0;
    if (dbTasks.length > 0) {
      actualMaxBids = Math.max(...dbTasks.map(t => t.bidsCount));
    }

    // B. Calculate dynamic simulation fluctuations for highly interactive dashboard behavior
    // These fluctuate organically over time to create realistic telemetry patterns
    const cycle = (this.simFluctuationTick * 12) % 360;
    const rad = (cycle * Math.PI) / 180;
    
    // Simulate transaction spikes
    const spikeModifier = Math.sin(rad) > 0.8 ? 5.2 : 1.0;
    const simTxCount = Math.floor((120 + Math.sin(rad) * 45) * spikeModifier) + (dbTxCount % 50);

    // Simulate failure rate spikes
    const simFailedRate = Math.cos(rad * 2) > 0.75 ? 0.28 : 0.03 + (dbFailedTx > 0 ? 0.02 : 0);

    // Simulate unusual gas consumption
    const gasModifier = Math.sin(rad * 3) > 0.85 ? 4.5 : 1.0;
    const simAvgGas = parseFloat((55 + Math.sin(rad * 1.5) * 15 * gasModifier).toFixed(2));

    // Inactive agents simulation
    const simInactive = Math.max(actualInactive, Math.cos(rad) > 0.7 ? 4 : 1);

    // High value wallet movements (randomly trigger large transfers)
    const simHighValue = Math.random() > 0.85 ? parseFloat((Math.random() * 450 + 50).toFixed(2)) : 0;

    // Congestion metrics (pending transactions queue length)
    const simPending = Math.floor(45 + Math.sin(rad * 2) * 40 + (spikeModifier > 1 ? 150 : 0));

    // Validator disagreements (simulated voting disputes)
    const simDisagreements = Math.random() > 0.9 ? Math.floor(Math.random() * 3 + 2) : 0;

    // Low liquidity condition simulation
    const simLiquidity = Math.max(5000, Math.floor(125000 + Math.sin(rad * 0.5) * 80000));

    return {
      txCountLastHour: simTxCount,
      failedTxRate: simFailedRate,
      avgGasPriceGwei: simAvgGas,
      inactiveAgentsCount: simInactive,
      highValueTransferEth: simHighValue,
      pendingTxCount: simPending,
      validatorDisagreementCount: simDisagreements,
      lowRepAgentsCount: actualLowRep || (Math.random() > 0.95 ? 1 : 0),
      stuckTasksCount: actualStuck,
      maxBidsOnTask: actualMaxBids,
      poolLiquidityUsdc: simLiquidity,
    };
  }
}

/**
 * 2. SIGNAL ANALYZER SERVICE
 * Evaluates collected metrics against defined system baselines and thresholds,
 * classifying anomalies and returning a prioritized signal array.
 */
export class SignalAnalyzer {
  // Threshold baselines
  private static readonly TX_SPIKE_THRESHOLD = 200;
  private static readonly FAILED_RATE_THRESHOLD = 0.15; // 15%
  private static readonly GAS_THRESHOLD_GWEI = 120;
  private static readonly INACTIVE_AGENT_THRESHOLD = 3;
  private static readonly HIGH_VALUE_ETH_THRESHOLD = 150;
  private static readonly CONGESTION_PENDING_THRESHOLD = 100;
  private static readonly VAL_DISAGREEMENT_THRESHOLD = 1;
  private static readonly LOW_REP_THRESHOLD = 1;
  private static readonly STUCK_TASK_THRESHOLD = 2;
  private static readonly BIDDING_WAR_THRESHOLD = 5;
  private static readonly LIQUIDITY_WARN_LEVEL = 20000;

  public static async analyzeSignals(metrics: SystemMetricSnapshot): Promise<DetectedSignal[]> {
    const signals: DetectedSignal[] = [];

    // 1. Blockchain transaction spikes
    if (metrics.txCountLastHour > this.TX_SPIKE_THRESHOLD) {
      const dev = (metrics.txCountLastHour - this.TX_SPIKE_THRESHOLD) / this.TX_SPIKE_THRESHOLD;
      signals.push({
        type: 'abnormal_tx_spike',
        value: metrics.txCountLastHour,
        severity: dev > 1.5 ? 'CRITICAL' : 'HIGH',
        urgencyScore: Math.min(100, Math.floor(70 + dev * 20)),
        confidenceScore: parseFloat((0.92 + Math.random() * 0.06).toFixed(3)),
        description: `Network load surge detected: ${metrics.txCountLastHour} transactions processed in the last hour.`,
        metadata: { threshold: this.TX_SPIKE_THRESHOLD, deviation: dev }
      });
    }

    // 2. Failed transaction rates
    if (metrics.failedTxRate > this.FAILED_RATE_THRESHOLD) {
      const ratePct = (metrics.failedTxRate * 100).toFixed(1);
      signals.push({
        type: 'failed_tx_rates',
        value: metrics.failedTxRate,
        severity: metrics.failedTxRate > 0.25 ? 'CRITICAL' : 'HIGH',
        urgencyScore: Math.min(100, Math.floor(75 + metrics.failedTxRate * 80)),
        confidenceScore: 0.98,
        description: `Critical contract failure rate detected! ${ratePct}% of transactions are reverting.`,
        metadata: { failureRatePct: ratePct }
      });
    }

    // 3. Unusual gas consumption
    if (metrics.avgGasPriceGwei > this.GAS_THRESHOLD_GWEI) {
      signals.push({
        type: 'unusual_gas_consumption',
        value: metrics.avgGasPriceGwei,
        severity: metrics.avgGasPriceGwei > 200 ? 'HIGH' : 'MEDIUM',
        urgencyScore: Math.min(100, Math.floor(50 + (metrics.avgGasPriceGwei - this.GAS_THRESHOLD_GWEI) * 0.4)),
        confidenceScore: 0.95,
        description: `Anomalous gas exhaustion: average gas prices are hovering at ${metrics.avgGasPriceGwei} Gwei.`,
        metadata: { normalGas: 50 }
      });
    }

    // 4. Inactive agents
    if (metrics.inactiveAgentsCount > this.INACTIVE_AGENT_THRESHOLD) {
      signals.push({
        type: 'inactive_agents',
        value: metrics.inactiveAgentsCount,
        severity: 'MEDIUM',
        urgencyScore: Math.min(100, 45 + (metrics.inactiveAgentsCount - this.INACTIVE_AGENT_THRESHOLD) * 10),
        confidenceScore: 0.89,
        description: `Operational bottleneck: ${metrics.inactiveAgentsCount} network agents have dropped offline or are inactive.`,
        metadata: { offlineCount: metrics.inactiveAgentsCount }
      });
    }

    // 5. High-value wallet movements
    if (metrics.highValueTransferEth > this.HIGH_VALUE_ETH_THRESHOLD) {
      signals.push({
        type: 'high_value_wallet_movements',
        value: metrics.highValueTransferEth,
        severity: 'HIGH',
        urgencyScore: 82,
        confidenceScore: 0.97,
        description: `High-value whale transaction alert: movement of ${metrics.highValueTransferEth} ETH detected.`,
        metadata: { transferValue: metrics.highValueTransferEth }
      });
    }

    // 6. Congestion metrics
    if (metrics.pendingTxCount > this.CONGESTION_PENDING_THRESHOLD) {
      signals.push({
        type: 'congestion_metrics',
        value: metrics.pendingTxCount,
        severity: metrics.pendingTxCount > 200 ? 'HIGH' : 'MEDIUM',
        urgencyScore: Math.min(100, 60 + Math.floor((metrics.pendingTxCount - this.CONGESTION_PENDING_THRESHOLD) * 0.3)),
        confidenceScore: 0.94,
        description: `Mempool congestion warning: ${metrics.pendingTxCount} transactions pending verification.`,
        metadata: { pendingCount: metrics.pendingTxCount }
      });
    }

    // 7. Repeated validator disagreements
    if (metrics.validatorDisagreementCount > this.VAL_DISAGREEMENT_THRESHOLD) {
      signals.push({
        type: 'validator_disagreement',
        value: metrics.validatorDisagreementCount,
        severity: 'CRITICAL',
        urgencyScore: 95,
        confidenceScore: 0.99,
        description: `Validator consensus split! ${metrics.validatorDisagreementCount} state disputes registered on-chain.`,
        metadata: { disputeCount: metrics.validatorDisagreementCount }
      });
    }

    // 8. Reputation anomalies
    if (metrics.lowRepAgentsCount >= this.LOW_REP_THRESHOLD) {
      signals.push({
        type: 'reputation_anomalies',
        value: metrics.lowRepAgentsCount,
        severity: 'HIGH',
        urgencyScore: 78,
        confidenceScore: 0.88,
        description: `Sybil alert: ${metrics.lowRepAgentsCount} agents registered an anomalous fall in reputation score.`,
        metadata: { affectedAgents: metrics.lowRepAgentsCount }
      });
    }

    // 9. Task completion bottlenecks
    if (metrics.stuckTasksCount > this.STUCK_TASK_THRESHOLD) {
      signals.push({
        type: 'task_completion_bottlenecks',
        value: metrics.stuckTasksCount,
        severity: 'MEDIUM',
        urgencyScore: 65,
        confidenceScore: 0.91,
        description: `SLA delay warning: ${metrics.stuckTasksCount} tasks are stalled in execution status.`,
        metadata: { stuckCount: metrics.stuckTasksCount }
      });
    }

    // 10. Bidding wars
    if (metrics.maxBidsOnTask > this.BIDDING_WAR_THRESHOLD) {
      signals.push({
        type: 'bidding_wars',
        value: metrics.maxBidsOnTask,
        severity: 'MEDIUM',
        urgencyScore: 55,
        confidenceScore: 0.85,
        description: `Hyper-competitive auction: bidding war detected with ${metrics.maxBidsOnTask} concurrent bids.`,
        metadata: { maxBids: metrics.maxBidsOnTask }
      });
    }

    // 11. Low liquidity conditions
    if (metrics.poolLiquidityUsdc < this.LIQUIDITY_WARN_LEVEL) {
      signals.push({
        type: 'low_liquidity_conditions',
        value: metrics.poolLiquidityUsdc,
        severity: 'HIGH',
        urgencyScore: 80,
        confidenceScore: 0.96,
        description: `Escrow pool depletion: liquidity pool dropped to $${metrics.poolLiquidityUsdc.toLocaleString()} USDC.`,
        metadata: { liquidityUsdc: metrics.poolLiquidityUsdc }
      });
    }

    // Save detected signals in database for audit history
    for (const sig of signals) {
      await prisma.systemSignal.create({
        data: {
          type: sig.type,
          value: sig.value,
          severity: sig.severity,
          metadata: JSON.stringify(sig.metadata),
        }
      });
    }

    return signals.sort((a, b) => b.urgencyScore - a.urgencyScore);
  }
}

/**
 * 3. PRIORITY SCORING MODULE
 * Translates signal weights into formal urgency levels, rewarding parameters,
 * and categories for the generated task.
 */
export class PriorityScoring {
  public static scoreTask(signal: DetectedSignal): {
    urgencyScore: number;
    category: TaskCategory;
    reward: number;
    rewardType: AssetType;
    economicImportance: 'Low' | 'Medium' | 'High' | 'Critical';
  } {
    const urgencyScore = signal.urgencyScore;
    
    // Category mapping
    let category: TaskCategory = 'Infrastructure';
    if (['failed_tx_rates', 'reputation_anomalies'].includes(signal.type)) {
      category = 'Security';
    } else if (['low_liquidity_conditions', 'unusual_gas_consumption'].includes(signal.type)) {
      category = 'DeFi';
    } else if (['abnormal_tx_spike', 'congestion_metrics'].includes(signal.type)) {
      category = 'Data Mining';
    } else if (['high_value_wallet_movements', 'validator_disagreement'].includes(signal.type)) {
      category = 'Strategy';
    }

    // Economic Importance Mapping
    let economicImportance: 'Low' | 'Medium' | 'High' | 'Critical' = 'Medium';
    if (signal.severity === 'CRITICAL') economicImportance = 'Critical';
    else if (signal.severity === 'HIGH') economicImportance = 'High';
    else if (signal.severity === 'LOW') economicImportance = 'Low';

    // Reward calculations (harder tasks/critical problems pay a massive bounty)
    const baseRewardType: AssetType = Math.random() > 0.4 ? 'ETH' : 'USDC';
    let rewardMultiplier = 1.0;
    if (economicImportance === 'Critical') rewardMultiplier = 3.5;
    else if (economicImportance === 'High') rewardMultiplier = 2.0;
    else if (economicImportance === 'Low') rewardMultiplier = 0.5;

    let reward = 0;
    if (baseRewardType === 'ETH') {
      reward = parseFloat(( (Math.random() * 0.15 + 0.05) * rewardMultiplier ).toFixed(4));
    } else {
      reward = parseFloat(( (Math.random() * 150 + 50) * rewardMultiplier ).toFixed(2));
    }

    return {
      urgencyScore,
      category,
      reward,
      rewardType: baseRewardType,
      economicImportance
    };
  }
}

/**
 * 4. TASK GENERATION ENGINE
 * Converts signals into fully fleshed-out Tasks, saves them in Postgres,
 * publishes them to WebSockets, and enqueues simulated agent bidding.
 */
export class TaskGenerationEngine {
  private static realtime: RealtimeService | null = null;

  public static setRealtime(realtimeService: RealtimeService) {
    this.realtime = realtimeService;
  }

  public static async generateTask(signal: DetectedSignal): Promise<Task> {
    const scoring = PriorityScoring.scoreTask(signal);

    const taskId = `SIG-${Math.floor(Math.random() * 900 + 100)}-${Date.now().toString(36).toUpperCase()}`;

    // Define rich signal-driven titles and technical specifications
    const signalDetails: Record<string, { title: string; desc: string; specs: string }> = {
      abnormal_tx_spike: {
        title: 'High-Load Transaction Routing & Batch Optimization',
        desc: `Autonomous mitigation task triggered by abnormal blockchain transaction spike (${signal.value} tx/hr). Review recent blocks and implement high-efficiency transaction batching algorithms.`,
        specs: 'Requires: Advanced Node Specialization\nMethodology: Rollup Batch Commit\nTarget Service: Somnia Mempool Router'
      },
      failed_tx_rates: {
        title: 'Decompiled EVM Revert Trace & Core Audit',
        desc: `Critical security job triggered by massive failure rate spikes (${(signal.value * 100).toFixed(1)}%). Analyze execution traces, parse debug logs, and patch vulnerable Solidity reentrancy or state logic.`,
        specs: 'Requires: Security Auditor Specialist\nMethodology: Static & Dynamic Call Analysis\nSecurity Level: 98% Proof Requirement'
      },
      unusual_gas_consumption: {
        title: 'Calldata Compression & EVM Gas Optimization',
        desc: `High gas consumption detected (${signal.value} Gwei). Refactor payload calldata, use custom compiler optimizations, and replace expensive storage access logs with memory-based maps.`,
        specs: 'Requires: DeFi Optimization Daemon\nMethodology: Yul/assembly refactoring\nExpected Gas Reduction: >35%'
      },
      inactive_agents: {
        title: 'Agent Offline Pulse Check & Diagnostic Service',
        desc: `Operational alert: ${signal.value} network agents have dropped offline. Probe registry endpoints, send heartbeat signals, and catalog system connectivity metrics to determine root network partition issues.`,
        specs: 'Requires: Infrastructure Node Tester\nMethodology: Heartbeat ICP-Ping\nScope: Global Node Registry'
      },
      high_value_wallet_movements: {
        title: 'Whale Liquidity Compliance & Proof Generation',
        desc: `Large movement of ${signal.value} ETH detected. Generate zero-knowledge transaction validity proofs and submit validator verification attestations to keep system compliance active.`,
        specs: 'Requires: Cryptographic Validator Agent\nMethodology: zk-SNARK Groth16 Proofs\nScope: Escrow Pool Settlement'
      },
      congestion_metrics: {
        title: 'Mempool Transaction De-congestion Queue Management',
        desc: `Mempool congestion high with ${signal.value} pending txs. Run node partition updates, prioritize high-tip txs, and optimize validator gossip protocols to clear state bottlenecks.`,
        specs: 'Requires: Core Protocol Agent\nMethodology: Block Propagation Optimization\nTarget: L1 Geth Client'
      },
      validator_disagreement: {
        title: 'Validator Vote Discrepancy & Dispute Resolution',
        desc: `CRITICAL split consensus: validator disagreement occurred ${signal.value} times. Gather validator votes, parse block hash logs, run dispute resolution logic, and verify states before settling payments.`,
        specs: 'Requires: Consensus Arb Specialist\nMethodology: Multi-signature State Validation\nReputation Level: >900 REP Required'
      },
      reputation_anomalies: {
        title: 'Agent Reputation Audit & Sybil Profile Scanner',
        desc: `Sybil alert: low reputation agents detected (${signal.value} agents). Audit recent bids, evaluate execution scores, isolate under-performing nodes, and verify ZK identity proofs.`,
        specs: 'Requires: Reputation Registry Auditor\nMethodology: Sybil Profile Indexing\nSecurity Level: HIGH'
      },
      task_completion_bottlenecks: {
        title: 'Stuck SLA Task Re-evaluation & Priority Re-route',
        desc: `${signal.value} running tasks are exceeding SLA deadlines. Cancel stalled matches, free locked escrows, recalculate urgency weightings, and re-publish jobs to active, high-priority nodes.`,
        specs: 'Requires: Workload Balancer Agent\nMethodology: Dynamic State Evacuation\nTimeout Constraint: 10 mins'
      },
      bidding_wars: {
        title: 'Auction Bid Capping & Dynamic Multiplier Adjuster',
        desc: `Hyper-competitive bidding war detected (${signal.value} concurrent bids). Run dynamic capping model, compute optimal bid multipliers, and prevent agent bid-shaving/collusion strategies.`,
        specs: 'Requires: Game Theory / Arb Specialist\nMethodology: Vickrey-Clarke-Groves Auction Tuning\nScope: Auction Module'
      },
      low_liquidity_conditions: {
        title: 'Escrow Pool Liquidity Provision & Cross-chain Arb',
        desc: `Liquidity pool depleted ($${signal.value.toLocaleString()} USDC). Bridge assets from external networks, trigger cross-chain re-funding transactions, and optimize platform commission rates.`,
        specs: 'Requires: DeFi Arbitrageur Agent\nMethodology: Cross-chain Bridge Routing\nTarget: Somnia Settlement Vault'
      }
    };

    const details = signalDetails[signal.type] || {
      title: 'Autonomous System Maintenance & Verification Scan',
      desc: `Signal-driven job triggered by system observation: ${signal.description}. Conduct baseline scans and verify integrity.`,
      specs: 'Requires: General Node Specialization\nMethodology: Complete State Audit\nTarget: Monorepo Core'
    };

    // Save task in PostgreSQL database via Prisma
    const task = await prisma.task.create({
      data: {
        id: taskId,
        title: details.title,
        category: scoring.category,
        tags: [scoring.category, 'SignalEngine', signal.type],
        reward: scoring.reward,
        rewardType: scoring.rewardType,
        bidsCount: 0,
        status: 'OPEN',
        desc: details.desc,
        specs: details.specs,
        creator: '0xSignalEngineAutonomousGateway',
        whyCreated: signal.description,
        sourceSignal: signal.type,
        urgencyScore: scoring.urgencyScore,
        economicImportance: scoring.economicImportance,
        confidenceScore: signal.confidenceScore,
      },
    });

    // ── WebSocket Synchronization ───────────────────────────────────────────
    if (this.realtime) {
      await this.realtime.publishTaskNew(task as any);
      
      const severityColorMap: Record<string, 'primary' | 'secondary' | 'error' | 'white'> = {
        LOW: 'white',
        MEDIUM: 'primary',
        HIGH: 'secondary',
        CRITICAL: 'error',
      };

      await this.realtime.publishLogNew({
        time: new Date().toLocaleTimeString(),
        text: `⚡ [SignalEngine] Spawned Task "${details.title}" | Trigger: ${signal.type.toUpperCase()} | Urgency: ${scoring.urgencyScore}/100 | Severity: ${signal.severity}`,
        type: severityColorMap[signal.severity] || 'primary',
      });
    }

    // ── Queue Integration (BullMQ) ─────────────────────────────────────────
    // Put the task on the BullMQ queue so that matching agents automatically bid on it!
    await taskQueue.add(
      'simulate-agent-bids',
      { taskId: task.id },
      { delay: 3500 } // Small delay to let user watch the event stream in real time
    );

    return task as any;
  }
}

/**
 * 5. SIGNAL ENGINE ORCHESTRATOR
 * Standard cron-style tick method that brings all the Signal Engine elements together.
 */
export class SignalEngine {
  public static async tick(realtime: RealtimeService): Promise<Task | null> {
    TaskGenerationEngine.setRealtime(realtime);

    try {
      // 1. Collect Metrics
      const metrics = await SignalCollector.collectMetrics();
      
      // 2. Analyze Metrics to identify Signals
      const signals = await SignalAnalyzer.analyzeSignals(metrics);

      if (signals.length === 0) {
        console.log('[SignalEngine] Metrics checked: no threshold deviations. Skipping task generation.');
        return null;
      }

      // 3. Take the highest urgency signal
      const primarySignal = signals[0];

      // 4. Generate Signal-Driven Task
      console.log(`[SignalEngine] Generating task for primary signal: ${primarySignal.type} (Urgency: ${primarySignal.urgencyScore})`);
      const task = await TaskGenerationEngine.generateTask(primarySignal);
      
      return task;
    } catch (err: any) {
      console.error('[SignalEngine] Error during tick:', err.message);
      
      realtime.publishLogNew({
        time: new Date().toLocaleTimeString(),
        text: `❌ [SignalEngine] Tick failure: ${err.message}`,
        type: 'error'
      });
      
      return null;
    }
  }
}
