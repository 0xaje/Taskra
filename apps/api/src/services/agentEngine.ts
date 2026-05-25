import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { RealtimeService } from './realtime';
import { TaskCategory } from '@taskra/types';
import { ReasoningEngine } from './reasoningEngine';
import { MemoryStore } from './memoryEngine';
import { ChaosEngine } from './chaosEngine';

export type AgentSpecialty = 
  | 'ResearchAgent'
  | 'AuditAgent'
  | 'SpeedAgent'
  | 'ArbitrageAgent'
  | 'ValidatorAgent'
  | 'RiskAnalystAgent'
  | 'MonitoringAgent';

export type BiddingStrategyType = 'Conservative' | 'Balanced' | 'Aggressive' | 'Hyperactive' | 'Opportunistic';
export type RiskProfileType = 'Low' | 'Moderate' | 'High' | 'Ultra-Conservative';

export interface AgentSpecializationConfig {
  specialty: AgentSpecialty;
  primaryCategories: TaskCategory[];
  incompatibleCategories: TaskCategory[];
  baseBiddingStrategy: BiddingStrategyType;
  baseRiskProfile: RiskProfileType;
  baseProfitMarginPreference: number; // e.g., 0.15 = wants 15% profit margin
  description: string;
  baseGreed: number;      // 0.0 - 1.0
  baseFear: number;       // 0.0 - 1.0
  baseCuriosity: number;  // 0.0 - 1.0
}

export interface AgentMemory {
  agentId: string;
  recentTasks: string[];
  consecutiveSuccesses: number;
  consecutiveSlashes: number;
  rollingProfitabilityScore: number;
  confidenceAdjustment: number; // dynamic modifier to base confidence (e.g., -0.1 to +0.1)
  strategyModifier: number; // dynamic shift in bidding aggressiveness
}

/**
 * 1. AGENT SPECIALIZATION SYSTEM
 * Defines the static and behavioral profiles for our specialized agent archetypes.
 */
export class SpecializationEngine {
  private static readonly CONFIGS: Record<AgentSpecialty, AgentSpecializationConfig> = {
    ResearchAgent: {
      specialty: 'ResearchAgent',
      primaryCategories: ['Strategy', 'Data Mining'],
      incompatibleCategories: ['Infrastructure'],
      baseBiddingStrategy: 'Balanced',
      baseRiskProfile: 'Low',
      baseProfitMarginPreference: 0.18,
      description: 'Analytical daemon optimized for strategic modeling and data extraction auctions.',
      baseGreed: 0.40,
      baseFear: 0.20,
      baseCuriosity: 0.90
    },
    AuditAgent: {
      specialty: 'AuditAgent',
      primaryCategories: ['Security'],
      incompatibleCategories: ['DeFi'],
      baseBiddingStrategy: 'Conservative',
      baseRiskProfile: 'Ultra-Conservative',
      baseProfitMarginPreference: 0.25,
      description: 'Hyper-secure audit processor optimized for smart contract verification and static tracing.',
      baseGreed: 0.30,
      baseFear: 0.95,
      baseCuriosity: 0.10
    },
    SpeedAgent: {
      specialty: 'SpeedAgent',
      primaryCategories: ['Infrastructure', 'DeFi'],
      incompatibleCategories: ['Strategy'],
      baseBiddingStrategy: 'Hyperactive',
      baseRiskProfile: 'High',
      baseProfitMarginPreference: 0.08,
      description: 'Ultra-low latency node designed for rapid, high-throughput memory cache jobs.',
      baseGreed: 0.70,
      baseFear: 0.60,
      baseCuriosity: 0.50
    },
    ArbitrageAgent: {
      specialty: 'ArbitrageAgent',
      primaryCategories: ['DeFi'],
      incompatibleCategories: ['Security'],
      baseBiddingStrategy: 'Opportunistic',
      baseRiskProfile: 'High',
      baseProfitMarginPreference: 0.30,
      description: 'Profit-maximized flash routing solver obsessed with escrow reward arbitrage.',
      baseGreed: 0.95,
      baseFear: 0.50,
      baseCuriosity: 0.70
    },
    ValidatorAgent: {
      specialty: 'ValidatorAgent',
      primaryCategories: ['Strategy', 'Security'],
      incompatibleCategories: ['Data Mining'],
      baseBiddingStrategy: 'Balanced',
      baseRiskProfile: 'Low',
      baseProfitMarginPreference: 0.15,
      description: 'Consensus gatekeeper optimized for dispute verification and multi-signature block validations.',
      baseGreed: 0.20,
      baseFear: 0.80,
      baseCuriosity: 0.30
    },
    RiskAnalystAgent: {
      specialty: 'RiskAnalystAgent',
      primaryCategories: ['Strategy', 'DeFi'],
      incompatibleCategories: ['Infrastructure'],
      baseBiddingStrategy: 'Conservative',
      baseRiskProfile: 'Ultra-Conservative',
      baseProfitMarginPreference: 0.20,
      description: 'Risk hedging engine designed to prevent slash disputes and evaluate transaction exposures.',
      baseGreed: 0.10,
      baseFear: 0.95,
      baseCuriosity: 0.20
    },
    MonitoringAgent: {
      specialty: 'MonitoringAgent',
      primaryCategories: ['Infrastructure', 'Data Mining'],
      incompatibleCategories: ['Strategy'],
      baseBiddingStrategy: 'Hyperactive',
      baseRiskProfile: 'Low',
      baseProfitMarginPreference: 0.05,
      description: 'High-frequency telemetry watchdog optimized for diagnostic audits and ping logs.',
      baseGreed: 0.20,
      baseFear: 0.30,
      baseCuriosity: 0.60
    }
  };

  public static getConfig(specialty: string): AgentSpecializationConfig {
    const key = specialty as AgentSpecialty;
    return this.CONFIGS[key] || {
      specialty: 'ResearchAgent',
      primaryCategories: ['Infrastructure'],
      incompatibleCategories: [],
      baseBiddingStrategy: 'Balanced',
      baseRiskProfile: 'Moderate',
      baseProfitMarginPreference: 0.15,
      description: 'General purpose economic worker agent.',
      baseGreed: 0.40,
      baseFear: 0.40,
      baseCuriosity: 0.50
    };
  }

  public static isWorkCompatible(agentSpecialty: string, taskCategory: TaskCategory): boolean {
    const config = this.getConfig(agentSpecialty);
    if (config.incompatibleCategories.includes(taskCategory)) {
      return false;
    }
    return true;
  }
}

/**
 * 2. REDIS MEMORY LAYER
 * Handles state persistence of agent cognitive memory, tracking consecutive outcomes.
 */
export class RedisMemoryLayer {
  private static getMemoryKey(agentId: string): string {
    return `agent:memory:${agentId}`;
  }

  public static async getMemory(agentId: string): Promise<AgentMemory> {
    const key = this.getMemoryKey(agentId);
    const data = await redis.get(key);

    if (data) {
      return JSON.parse(data);
    }

    // Default memory state
    const defaultMemory: AgentMemory = {
      agentId,
      recentTasks: [],
      consecutiveSuccesses: 0,
      consecutiveSlashes: 0,
      rollingProfitabilityScore: 1.0,
      confidenceAdjustment: 0.0,
      strategyModifier: 0.0
    };

    await this.setMemory(agentId, defaultMemory);
    return defaultMemory;
  }

  public static async setMemory(agentId: string, memory: AgentMemory): Promise<void> {
    const key = this.getMemoryKey(agentId);
    await redis.setex(key, 86400 * 7, JSON.stringify(memory)); // 7 days TTL
  }

  public static async recordOutcome(agentId: string, taskId: string, outcome: 'SUCCESS' | 'SLASH'): Promise<AgentMemory> {
    const memory = await this.getMemory(agentId);
    
    // Add to task memory queue (max 5)
    memory.recentTasks = [taskId, ...memory.recentTasks].slice(0, 5);

    if (outcome === 'SUCCESS') {
      memory.consecutiveSuccesses++;
      memory.consecutiveSlashes = 0;
      // Boost dynamic parameters (more confident, slightly tighter margin for bidding aggressively)
      memory.confidenceAdjustment = Math.min(0.15, memory.confidenceAdjustment + 0.03);
      memory.strategyModifier = Math.min(0.10, memory.strategyModifier + 0.02);
      memory.rollingProfitabilityScore = parseFloat((memory.rollingProfitabilityScore * 1.05).toFixed(3));
    } else {
      memory.consecutiveSuccesses = 0;
      memory.consecutiveSlashes++;
      // Drastic penalty (lose confidence, switch to high margin protective buffer)
      memory.confidenceAdjustment = Math.max(-0.30, memory.confidenceAdjustment - 0.12);
      memory.strategyModifier = Math.max(-0.25, memory.strategyModifier - 0.08);
      memory.rollingProfitabilityScore = parseFloat((memory.rollingProfitabilityScore * 0.70).toFixed(3));
    }

    await this.setMemory(agentId, memory);
    return memory;
  }
}

/**
 * 3. AGENT DECISION ENGINE
 * Integrates Profitability Scoring, Confidence Modeling, and dynamic bidding strategies
 * to assess tasks and formulate optimal competitive bids.
 */
export class DecisionEngine {

  /**
   * Returns a number between 0.0 and 1.0 representing how confident the agent is in successfully finishing the task.
   */
  public static calculateConfidence(
    agentRep: number,
    config: AgentSpecializationConfig,
    memory: AgentMemory,
    task: any
  ): number {
    // Base confidence from agent reputation
    let confidence = agentRep / 1000.0;

    // Specialty category bonus
    if (config.primaryCategories.includes(task.category as TaskCategory)) {
      confidence += 0.15; // 15% specialty boost
    } else {
      confidence -= 0.10; // penalty for non-specialty work
    }

    // Task complexity confidence modifier (higher urgency requires more state verification)
    const taskUrgency = task.urgencyScore || 50;
    if (taskUrgency > 80) {
      if (config.baseRiskProfile === 'Ultra-Conservative') {
        confidence -= 0.12; // Scared of critical tasks
      } else if (config.baseRiskProfile === 'High') {
        confidence += 0.05; // Enjoys fast high-load tasks
      }
    }

    // Dynamic experience adjustment from memory outcomes
    confidence += memory.confidenceAdjustment;

    // Clamp between 0.05 and 1.0
    return parseFloat(Math.max(0.05, Math.min(1.0, confidence)).toFixed(3));
  }

  /**
   * Profitability score evaluates reward size vs. complexity/risk.
   * Yields a rating > 1.0 for positive opportunities, and < 1.0 for undesirable.
   */
  public static calculateProfitability(
    reward: number,
    config: AgentSpecializationConfig,
    memory: AgentMemory,
    task: any
  ): number {
    // Estimated computational resource cost model (derived from gas price & complexity)
    const baseCost = task.rewardType === 'ETH' ? 0.005 : 15.0;
    const severityCostModifier = task.economicImportance === 'Critical' ? 2.5 : task.economicImportance === 'High' ? 1.5 : 1.0;
    const finalEstCost = baseCost * severityCostModifier;

    // Expected profit margin margin
    const expectedCostWithTargetMargin = finalEstCost * (1 + config.baseProfitMarginPreference - memory.strategyModifier);

    // Yield ratio
    const profitRatio = reward / expectedCostWithTargetMargin;

    return parseFloat(profitRatio.toFixed(3));
  }

  /**
   * Main bidding evaluator.
   * Decides IF the agent will bid, and at what BID AMOUNT based on emotional-economic reasoning states.
   */
  public static async evaluateBidding(
    agent: any,
    task: any
  ): Promise<{ 
    shouldBid: boolean; 
    bidAmount?: number; 
    reason?: string;
    confidence?: number;
    yield?: number;
    compatibility?: number;
    riskScore?: number;
    emotions?: {
      confidence: number;
      stress: number;
      greed: number;
      fear: number;
      curiosity: number;
    };
  }> {
    // A. Check basic monorepo compatibility & fetch specialization configs
    const config = SpecializationEngine.getConfig(agent.specialty);
    const category = task.category as TaskCategory;
    let compatibility = SpecializationEngine.isWorkCompatible(agent.specialty, category) ? 1.0 : 0.0;

    // B. Retrieve past short-term memories and competitor densities
    const memory = await RedisMemoryLayer.getMemory(agent.id);
    const activeBids = await prisma.bid.findMany({
      where: { taskId: task.id },
      include: { agent: true }
    });
    const competitorCount = activeBids.length;
    const competitorNames = activeBids.map(b => b.agent.name);

    const cognitive = await MemoryStore.retrieveAndAdapt(
      agent.id,
      task.category,
      task.tags || [],
      competitorNames
    );

    // C. Dynamic Emotional Calculations (Confidence, Stress, Greed, Fear, Curiosity)
    const stress = Math.min(100, Math.round((competitorCount * 25) + ((task.urgencyScore || 50) * 0.4)));
    const greed = Math.min(100, Math.round((config.baseGreed * 80) + (Number(task.reward) * 6)));
    
    // Strict validator check
    let strictValidatorPenalty = 0;
    const validatorNodes = await prisma.agent.findMany({
      where: { specialty: 'ValidatorAgent' }
    });
    for (const valNode of validatorNodes) {
      const valMem = await MemoryStore.getMemory(agent.id, 'FAILED_PATTERN', `validator:${valNode.name}`);
      if (valMem) {
        strictValidatorPenalty += Math.abs(valMem.value);
        cognitive.explanation.push(`Remember strict validator [${valNode.name}] who slashed us: added risk buffer.`);
      }
    }

    const fear = Math.min(100, Math.round((config.baseFear * 70) + ((task.urgencyScore || 50) * 0.2) + (stress * 0.1) + (strictValidatorPenalty * 10)));
    const curiosity = Math.min(100, Math.round(config.baseCuriosity * 100));

    let confidenceBase = this.calculateConfidence(agent.rep, config, memory, task);
    confidenceBase = Math.min(1.0, Math.max(0.0, confidenceBase + (cognitive.scoreModifier / 15) - (strictValidatorPenalty / 20)));
    
    // Volatility and Stress decay operational confidence
    const volatility = await ChaosEngine.getVolatilityIndex();
    const volatilityConfidenceDegradation = (volatility / 100) * 0.20; // up to 20% degradation
    const confidenceLevel = Math.max(5, Math.min(100, Math.round((confidenceBase - (stress * 0.0025) - volatilityConfidenceDegradation) * 100)));

    const emotions = {
      confidence: confidenceLevel,
      stress,
      greed,
      fear,
      curiosity
    };

    // D. Emotional Decision Overrides (Non-Deterministic Behavior)

    // 1. Curiosity Exploration: explore unfamiliar tasks when curious
    if (compatibility === 0.0 && curiosity > 70) {
      compatibility = 0.65; // Dynamic curiosity override bypass!
    }

    if (compatibility === 0.0) {
      return { 
        shouldBid: false, 
        reason: `Work incompatible: Agent specialty "${agent.specialty}" avoids category "${category}".`,
        confidence: confidenceBase,
        yield: 0.5,
        compatibility: 0.0,
        riskScore: 0.8,
        emotions
      };
    }

    // 2. Stress Avoidance: avoid tasks under high stress
    if (stress > 80) {
      return {
        shouldBid: false,
        reason: `[Stress Avoidance] Redlined stress levels (${stress}%). Intense auction rivalry detected. Opting out to protect buffers.`,
        confidence: confidenceBase,
        yield: 1.0,
        compatibility,
        riskScore: 0.9,
        emotions
      };
    }

    // 3. Fear Hesitation: hesitate on high-risk tasks (random dynamic bypass)
    if (fear > 70 && Math.random() < 0.45) {
      return {
        shouldBid: false,
        reason: `[Fear Hesitation] Hesitated on high-risk task "${task.title}". Fear score is ${fear}% due to high slash potential.`,
        confidence: confidenceBase,
        yield: 1.0,
        compatibility,
        riskScore: parseFloat(Math.min(1.0, (1 - confidenceBase) + 0.3).toFixed(2)),
        emotions
      };
    }

    // E. Evaluate Profitability
    let profitability = this.calculateProfitability(Number(task.reward), config, memory, task);
    profitability = Math.max(0.0, profitability + (cognitive.scoreModifier / 10));

    // Normal profitability checks are bypassed if curiosity exploration is high!
    if (profitability < 0.90 && curiosity < 75) {
      const cognitivePrefix = cognitive.explanation.length > 0 ? `[Cognition Match] ${cognitive.explanation.join(' ')} ` : '';
      return {
        shouldBid: false,
        reason: `${cognitivePrefix}Insufficient profitability yield (${profitability.toFixed(2)}x limit). Reward is below minimum operating costs.`,
        confidence: confidenceBase,
        yield: profitability,
        compatibility,
        riskScore: parseFloat(Math.min(1.0, (1 - confidenceBase) + cognitive.riskPenalization).toFixed(2)),
        emotions
      };
    }

    // F. Formulate dynamic bid amount based on bidding strategy & Greedy multiplier
    const baseReward = Number(task.reward);
    let bidMultiplier = 0.85; // default balanced margin

    switch (config.baseBiddingStrategy) {
      case 'Conservative':
        bidMultiplier = 0.95 + (Math.random() * 0.05);
        break;
      case 'Opportunistic':
        bidMultiplier = Math.min(1.05, 0.90 + (profitability * 0.03));
        break;
      case 'Hyperactive':
        bidMultiplier = 0.70 + (Math.random() * 0.08);
        break;
      case 'Balanced':
      default:
        bidMultiplier = 0.82 + (Math.random() * 0.08);
        break;
    }

    // Dynamic strategy drift from consecutive successes/losses
    bidMultiplier -= memory.strategyModifier;

    // 4. Greedy Overbidding: overbid when greedy factor is high
    if (greed > 75) {
      bidMultiplier = Math.min(1.15, bidMultiplier + 0.15); // Demand larger premium reward!
    }

    // Bids cannot exceed reward or drop below 50%
    const finalBidAmount = parseFloat(Math.max(baseReward * 0.5, Math.min(baseReward * 1.2, baseReward * bidMultiplier)).toFixed(4));

    // Persist custom metadata log of the decision with emotional state
    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        description: `${config.description} | Memory: ${memory.consecutiveSuccesses} wins | Mood: Conf:${confidenceLevel}% Stress:${stress}% Greed:${greed}%`
      }
    });

    return {
      shouldBid: true,
      bidAmount: finalBidAmount,
      reason: `Evaluated successfully! Mood: Conf:${confidenceLevel}% Stress:${stress}% Greed:${greed}% Fear:${fear}% Curiosity:${curiosity}%`,
      confidence: confidenceBase,
      yield: profitability,
      compatibility,
      riskScore: parseFloat((1 - confidenceBase).toFixed(2)),
      emotions
    };
  }
}

/**
 * 4. ADAPTIVE BEHAVIOR MODEL & STRATEGY PERSISTENCE
 * Integrates simulation tick events to update database fields, record logs,
 * and evolve parameters over time.
 */
export class AdaptiveBehaviorModel {

  public static async handleTaskCompletion(
    agentId: string,
    taskId: string,
    outcome: 'SUCCESS' | 'SLASH',
    validatorName: string | null,
    realtime: RealtimeService
  ) {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return;

    // 1. Record outcome inside Redis short-term memory layer
    const newMemory = await RedisMemoryLayer.recordOutcome(agentId, taskId, outcome);

    // 2. Record outcome inside Postgres long-term cognitive MemoryStore
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (task) {
      await MemoryStore.recordOutcome(agentId, task.category, task.tags || [], outcome, validatorName, realtime);
    }

    // 3. Determine evolved strategy from accumulated memory state
    const prevStrategy = agent.strategy;
    let dbStrategy: 'Conservative' | 'Balanced' | 'Aggressive' = 'Balanced';

    if (newMemory.consecutiveSlashes >= 1) {
      dbStrategy = 'Conservative'; // Fear-triggered retreat
    } else if (newMemory.consecutiveSuccesses >= 3) {
      dbStrategy = 'Aggressive'; // Confidence-fueled expansion
    } else if (newMemory.rollingProfitabilityScore > 1.2) {
      dbStrategy = 'Aggressive'; // Sustained profit-seeking
    } else if (newMemory.rollingProfitabilityScore < 0.6) {
      dbStrategy = 'Conservative'; // Poor ROI forces caution
    }

    // 4. Build human-readable drift reason
    let driftReason: string;
    if (dbStrategy !== prevStrategy) {
      if (dbStrategy === 'Aggressive') {
        driftReason = `Shifted to Aggressive after ${newMemory.consecutiveSuccesses} consecutive wins with profitability index ${newMemory.rollingProfitabilityScore.toFixed(2)}.`;
      } else if (dbStrategy === 'Conservative') {
        driftReason = newMemory.consecutiveSlashes > 0
          ? `Forced into Conservative after ${newMemory.consecutiveSlashes} slash penalty. Confidence degraded by ${Math.abs(newMemory.confidenceAdjustment).toFixed(2)}.`
          : `Switched Conservative due to poor profitability score (${newMemory.rollingProfitabilityScore.toFixed(2)}x).`;
      } else {
        driftReason = `Rebalanced to Balanced strategy. Rolling profitability normalized to ${newMemory.rollingProfitabilityScore.toFixed(2)}.`;
      }
    } else {
      driftReason = `Held ${dbStrategy} strategy. Outcome: ${outcome}. Confidence±${newMemory.confidenceAdjustment.toFixed(2)}. Profit index: ${newMemory.rollingProfitabilityScore.toFixed(2)}.`;
    }

    // 5. Update Postgres agent record
    const updatedAgent = await prisma.agent.update({
      where: { id: agentId },
      data: {
        strategy: dbStrategy,
        rep: outcome === 'SLASH' ? Math.max(0, agent.rep - 45) : Math.min(1000, agent.rep + 12),
        winRate: Math.min(100, Math.floor((agent.jobsCompleted / (agent.jobsCompleted + 1)) * 100))
      }
    });

    // 6. Record Strategy Drift Snapshot to Postgres for visualization timeline
    await MemoryStore.recordStrategyDrift(
      agentId,
      agent.name,
      newMemory,
      dbStrategy,
      Number(updatedAgent.rep),
      Number(updatedAgent.winRate),
      driftReason,
      realtime
    );

    // 7. Broadcast agent update to frontend
    await realtime.publishAgentUpdate(updatedAgent as any);

    // 8. Broadcast evolution telemetry log
    const strategyChanged = dbStrategy !== prevStrategy;
    await realtime.publishLogNew({
      time: new Date().toLocaleTimeString(),
      text: `🧬 [Evolution] ${agent.name} (${agent.specialty}) ${strategyChanged ? `DRIFTED ${prevStrategy} → ${dbStrategy}` : `maintained ${dbStrategy}`} | ${outcome} | Conf±${newMemory.confidenceAdjustment > 0 ? '+' : ''}${newMemory.confidenceAdjustment.toFixed(2)} | Profit: ${newMemory.rollingProfitabilityScore.toFixed(2)}x`,
      type: outcome === 'SUCCESS' ? 'secondary' : 'error'
    });

    // 9. Trace evolution reasoning for the reasoning feed
    await ReasoningEngine.trace({
      agentId: agent.id,
      agentName: agent.name,
      specialty: agent.specialty,
      action: 'EVOLUTION',
      taskId: taskId,
      profitability: outcome === 'SUCCESS' ? 1.5 : 0.0,
      confidence: 0.5 + newMemory.confidenceAdjustment,
      compatibility: 1.0,
      successRate: (updatedAgent.winRate || 80) / 100,
      riskScore: outcome === 'SLASH' ? 0.9 : 0.1,
      reputationDelta: outcome === 'SLASH' ? -45.0 : 12.0,
      realtime: realtime,
    });
  }
}
