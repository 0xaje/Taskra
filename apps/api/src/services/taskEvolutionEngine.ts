import { prisma } from '../config/database';
import { RealtimeService } from './realtime';

export type EvolutionTriggerType = 'AUDIT_VULNERABILITY' | 'ANALYTICS_ANOMALY' | 'FAILED_EXECUTION' | 'CONGESTION_SPIKE';

export interface TaskEvolutionConfig {
  trigger: EvolutionTriggerType;
  childTitle: string;
  childCategory: 'Security' | 'DeFi' | 'Data Mining' | 'Strategy' | 'Infrastructure';
  rewardMultiplier: number;
  urgencyScore: number;
  tags: string[];
  description: string;
  specs: string;
  analysisTemplate: string;
  anomaliesTemplate: string;
}

export class TaskEvolutionEngine {
  private static readonly MAX_DEPTH = 4;

  private static readonly CONFIGURATIONS: Record<EvolutionTriggerType, TaskEvolutionConfig> = {
    AUDIT_VULNERABILITY: {
      trigger: 'AUDIT_VULNERABILITY',
      childTitle: 'Remediate Audited Vulnerability in Smart Contract',
      childCategory: 'Security',
      rewardMultiplier: 1.25,
      urgencyScore: 92,
      tags: ['security', 'remediation', 'patch'],
      description: 'Critical code remediation required to secure the contract against high-risk reentrancy and unauthorized state mutations discovered during automated audit scan.',
      specs: 'Target: Deployed contract address. Action: Integrate ReentrancyGuard, add safe-math checks, and lock administrative function visibility.',
      analysisTemplate: 'EVM codebase contract audit completed successfully by security runtime. Zero-knowledge authentication and state transitions fully parsed.',
      anomaliesTemplate: 'Detected 1 critical reentrancy vector in transfer balance calls and 2 access control bypasses in administrative override functions.',
    },
    ANALYTICS_ANOMALY: {
      trigger: 'ANALYTICS_ANOMALY',
      childTitle: 'Optimize Gas Footprint & Calldata Latency',
      childCategory: 'Infrastructure',
      rewardMultiplier: 1.15,
      urgencyScore: 78,
      tags: ['infrastructure', 'gas-optimization', 'calldata'],
      description: 'Refactor EVM memory layouts, compress calldata structures, and replace repetitive storage reads to reduce extreme gas expenditure and propagation latency.',
      specs: 'Target: Contract assembly routines. Action: Introduce custom Yul/assembly loops, replace storage logs with memory-based caches, and minimize calldata footprint.',
      analysisTemplate: 'EVM gas profiling and throughput benchmarks completed. Captured execution logs and mempool gossip parameters.',
      anomaliesTemplate: 'Detected CPU latency overhead exceeding 140ms in block propagation and duplicate calldata parsing loops.',
    },
    FAILED_EXECUTION: {
      trigger: 'FAILED_EXECUTION',
      childTitle: 'Debug Computational State Revert Exception',
      childCategory: 'Infrastructure',
      rewardMultiplier: 1.50, // Premium for emergency debugging tasks
      urgencyScore: 85,
      tags: ['infrastructure', 'debugging', 'recovery'],
      description: 'Trace state execution logs, parse revert pointers, and commit dynamic exception handlers to salvage the crashed task thread and stabilize agent validation cycles.',
      specs: 'Target: Agent state execution loop. Action: Isolate execution thread, debug memory allocation pointers, and patch callstack recursion bounds.',
      analysisTemplate: 'Agent failed computational task execution. State engine registers an abrupt transaction revert.',
      anomaliesTemplate: 'Callstack recovery trace shows OutOfGas/StackOverflow exception at storage slot 0x4F8B during transaction batching.',
    },
    CONGESTION_SPIKE: {
      trigger: 'CONGESTION_SPIKE',
      childTitle: 'Implement Sharded Queue & Scale Router Throughput',
      childCategory: 'Infrastructure',
      rewardMultiplier: 1.20,
      urgencyScore: 82,
      tags: ['infrastructure', 'scaling', 'load-balancing'],
      description: 'Introduce multi-sharded network routing queues, optimize block compression algorithms, and scale validator gossip pacing to resolve transaction processing delays.',
      specs: 'Target: Mempool routing queues. Action: Deploy dynamic sharded transaction queues and adjust consensus gossip protocols.',
      analysisTemplate: 'High-load throughput metrics analyzed. Mempool queue and validator gossip rates audited.',
      anomaliesTemplate: 'Validator agreement rates dipped below 80% during transaction spike, mempool backlog peaked at 520 pending txs.',
    },
  };

  /**
   * Processes completed/slashed task and recursively orchestrates chain reactions!
   */
  public static async processTaskEvolution(
    taskId: string,
    outcome: 'SUCCESS' | 'SLASH',
    realtime: RealtimeService
  ): Promise<any | null> {
    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
      });

      if (!task) return null;

      // 1. Guard against infinite feedback loops
      if (task.evolutionDepth >= this.MAX_DEPTH) {
        realtime.publishLogNew({
          time: new Date().toLocaleTimeString(),
          text: `⚡ Lineage tree for Task [${task.title}] hit max depth limit (${this.MAX_DEPTH}). Cascade halted.`,
          type: 'white',
        });
        return null;
      }

      let selectedConfig: TaskEvolutionConfig | null = null;

      // 2. Decide evolution cascade trigger scenario based on completed task properties
      if (outcome === 'SLASH') {
        // Scenario 1: Slashed execution triggers debugging tasks
        selectedConfig = this.CONFIGURATIONS.FAILED_EXECUTION;
      } else {
        // Scenario 2: Successful tasks trigger child tasks depending on category/keywords
        const titleLower = task.title.toLowerCase();

        if (task.category === 'Security' || titleLower.includes('audit') || titleLower.includes('scan') || titleLower.includes('vulnerability')) {
          // Completed Audit -> Vulnerability Remediation Fix
          selectedConfig = this.CONFIGURATIONS.AUDIT_VULNERABILITY;
        } else if (titleLower.includes('congestion') || titleLower.includes('load') || titleLower.includes('mempool') || titleLower.includes('tps')) {
          // Congestion Task -> Scaling/Load Balancing
          selectedConfig = this.CONFIGURATIONS.CONGESTION_SPIKE;
        } else if (task.category === 'Infrastructure' || titleLower.includes('performance') || titleLower.includes('optimize') || titleLower.includes('optimization') || titleLower.includes('gas') || titleLower.includes('latency')) {
          // Performance Task -> Optimization
          selectedConfig = this.CONFIGURATIONS.ANALYTICS_ANOMALY;
        } else {
          // Default fallbacks with random probability
          const rand = Math.random();
          if (rand < 0.3) {
            selectedConfig = this.CONFIGURATIONS.ANALYTICS_ANOMALY;
          } else if (rand < 0.5) {
            selectedConfig = this.CONFIGURATIONS.AUDIT_VULNERABILITY;
          }
        }
      }

      if (!selectedConfig) return null;

      // 3. Dynamic Economic Propagation (Dynamic Reward Inheritance)
      const parentReward = Number(task.reward);
      const childReward = parseFloat((parentReward * selectedConfig.rewardMultiplier).toFixed(4));

      // Calculate Lineage Score: decays organically with depth and increases with higher severity/urgency
      const baseLineage = 1.0 - (task.evolutionDepth * 0.18);
      const severityFactor = selectedConfig.urgencyScore / 100;
      const noise = (Math.random() * 0.06) - 0.03;
      const lineageScore = parseFloat(Math.max(0.05, Math.min(1.0, baseLineage * 0.85 + severityFactor * 0.15 + noise)).toFixed(3));

      // Configure Economic Inheritance Rules
      const economicInheritanceRules = `REWARD_MULTIPLIER: ${selectedConfig.rewardMultiplier}x | PARENT_VAL: ${parentReward} ${task.rewardType} | PARENT_ID: ${task.id} | ASSET: ${task.rewardType}`;

      const evolutionReason = `Completed parent task revealed critical system requirement. Triggered evolution cascade type: ${selectedConfig.trigger}.`;

      // Compose full HTML/Markdown lineage report in description
      const childDescription = `### Task Evolution Lineage Report
**Parent Task ID:** \`${task.id}\`
**Trigger Condition:** \`${selectedConfig.trigger}\`
**Lineage Score:** \`${lineageScore}\` / 1.0

#### 1. Parent Execution Analysis
${selectedConfig.analysisTemplate}

#### 2. Anomalies & Discoveries Detected
⚠️ ${selectedConfig.anomaliesTemplate}

#### 3. Child Scope of Work
${selectedConfig.description}`;

      const childSpecs = `### Economic Inheritance Rules
${economicInheritanceRules}

### Technical Specifications
${selectedConfig.specs}
---
Parent Title: "${task.title}"`;

      // 4. Autonomous Node Generation & Lineage Persistence
      const childTask = await prisma.task.create({
        data: {
          title: `[Evolution] ${selectedConfig.childTitle}`,
          category: selectedConfig.childCategory,
          tags: [...selectedConfig.tags, 'Evolution'],
          reward: childReward,
          rewardType: task.rewardType,
          status: 'OPEN',
          desc: childDescription,
          specs: childSpecs,
          creator: '0xSystemAutonomousEngine',
          parentId: task.id,
          evolutionDepth: task.evolutionDepth + 1,
          evolutionTrigger: selectedConfig.trigger,
          evolutionReason: evolutionReason,
          lineageScore: lineageScore,
          economicInheritanceRules: economicInheritanceRules,
          whyCreated: `Cascaded recursively from Parent Task: "${task.title}". Trigger: ${selectedConfig.trigger}. Reason: ${evolutionReason}. Lineage score: ${lineageScore}.`,
          sourceSignal: `Parent: ${task.id}`,
          urgencyScore: selectedConfig.urgencyScore,
          economicImportance: childReward > 2.0 ? 'CRITICAL' : childReward > 0.8 ? 'HIGH' : 'STANDARD',
          confidenceScore: 0.88,
        },
      });

      // 5. Chain Reaction WebSockets Broadcasting
      realtime.publishLogNew({
        time: new Date().toLocaleTimeString(),
        text: `🌀 [Evolution] "${task.title}" spawned: "${childTask.title}" (Reward: ${childReward} ${task.rewardType}, Score: ${lineageScore})`,
        type: 'primary',
      });

      // Emit new task through real-time channel
      await realtime.publishTaskNew(childTask as any);

      // Emit update on the parent task to link lineage (adds child connection)
      const updatedParent = await prisma.task.findUnique({
        where: { id: task.id },
        include: { children: true }
      });
      if (updatedParent) {
        await realtime.publishTaskUpdate(updatedParent as any);
      }

      return childTask;
    } catch (err: any) {
      console.error('[TaskEvolution] Failed to process evolution cascade:', err.message);
      return null;
    }
  }

  /**
   * Fetches task lineage tree (complete recursive parent-child graph)
   */
  public static async getTaskLineage(taskId: string): Promise<any> {
    const rootTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        children: true,
      },
    });

    if (!rootTask) return null;

    // Load full lineage tree recursively
    const buildTree = async (node: any): Promise<any> => {
      const children = await prisma.task.findMany({
        where: { parentId: node.id },
      });

      const childrenNodes = [];
      for (const child of children) {
        const enriched = await buildTree(child);
        childrenNodes.push(enriched);
      }

      return {
        ...node,
        children: childrenNodes,
      };
    };

    return buildTree(rootTask);
  }
}
