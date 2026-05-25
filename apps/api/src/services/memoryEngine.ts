import { prisma } from '../config/database';
import { RealtimeService } from './realtime';

export type MemoryType = 'PROFITABLE_TASK' | 'FAILED_PATTERN' | 'RISKY_COMPETITOR' | 'SUCCESSFUL_STRATEGY' | 'ECONOMIC_TREND';

export interface MemoryItem {
  agentId: string;
  type: MemoryType;
  key: string;
  value: number;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  explanation: string;
}

export interface StrategyDriftRecord {
  id?: string;
  agentId: string;
  cycleNumber: number;
  strategy: string;
  repScore: number;
  winRate: number;
  confidenceAdj: number;
  strategyModifier: number;
  consecutiveSuccesses: number;
  consecutiveSlashes: number;
  rollingProfitability: number;
  dominantMemoryType: string;
  driftReason: string;
  createdAt?: string;
}

export class MemoryStore {
  // Hot in-memory cache emulating high-speed Redis layer
  private static hotCache: Map<string, MemoryItem> = new Map();
  // Per-agent cycle counter for drift snapshot tracking
  private static cycleCounters: Map<string, number> = new Map();

  /** Generate cache key for agent memory */
  private static getCacheKey(agentId: string, type: MemoryType, key: string): string {
    return `${agentId}:${type}:${key}`;
  }

  /** Retrieve memory item either from hot Cache or bootstrap it from Prisma db */
  public static async getMemory(agentId: string, type: MemoryType, key: string): Promise<MemoryItem | null> {
    const cacheKey = this.getCacheKey(agentId, type, key);
    if (this.hotCache.has(cacheKey)) {
      return this.hotCache.get(cacheKey)!;
    }

    const dbItem = await prisma.agentMemory.findUnique({
      where: { agentId_type_key: { agentId, type, key } },
    });

    if (dbItem) {
      const memory: MemoryItem = {
        agentId: dbItem.agentId,
        type: dbItem.type as MemoryType,
        key: dbItem.key,
        value: dbItem.value,
        sentiment: dbItem.sentiment as 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL',
        explanation: dbItem.explanation,
      };
      this.hotCache.set(cacheKey, memory);
      return memory;
    }
    return null;
  }

  /** Write / Upsert memory item to Hot Cache and queue postgres write */
  public static async saveMemory(item: MemoryItem, realtime?: RealtimeService | null): Promise<MemoryItem> {
    const cacheKey = this.getCacheKey(item.agentId, item.type, item.key);
    this.hotCache.set(cacheKey, item);

    await prisma.agentMemory.upsert({
      where: { agentId_type_key: { agentId: item.agentId, type: item.type, key: item.key } },
      update: { value: item.value, sentiment: item.sentiment, explanation: item.explanation },
      create: {
        agentId: item.agentId,
        type: item.type,
        key: item.key,
        value: item.value,
        sentiment: item.sentiment,
        explanation: item.explanation,
      },
    });

    if (realtime) {
      const agent = await prisma.agent.findUnique({ where: { id: item.agentId } });
      realtime.publishLogNew({
        time: new Date().toLocaleTimeString(),
        text: `🧠 [Cognition] ${agent?.name || 'Agent'} encoded memory: ${item.type} [${item.key}] -> Weight: ${item.value.toFixed(1)} (${item.sentiment})`,
        type: item.sentiment === 'POSITIVE' ? 'secondary' : item.sentiment === 'NEGATIVE' ? 'error' : 'white',
      });
    }

    return item;
  }

  /** Retrieve all memories for an agent */
  public static async getAllMemories(agentId: string): Promise<MemoryItem[]> {
    const dbMemories = await prisma.agentMemory.findMany({
      where: { agentId },
      orderBy: { updatedAt: 'desc' },
    });

    return dbMemories.map(m => ({
      agentId: m.agentId,
      type: m.type as MemoryType,
      key: m.key,
      value: m.value,
      sentiment: m.sentiment as 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL',
      explanation: m.explanation,
    }));
  }

  // ── Retrieval & Decision Adaptation Engine ─────────────────────────────────

  /** Evaluates memory modifiers for task evaluation, letting agents learn from outcomes */
  public static async retrieveAndAdapt(
    agentId: string,
    category: string,
    tags: string[],
    competitors: string[]
  ): Promise<{
    scoreModifier: number;
    explanation: string[];
    riskPenalization: number;
  }> {
    let scoreModifier = 0;
    let riskPenalization = 0;
    const explanation: string[] = [];

    // 1. Profitable task category memory
    const catMemory = await this.getMemory(agentId, 'PROFITABLE_TASK', `category:${category}`);
    if (catMemory) {
      scoreModifier += catMemory.value;
      explanation.push(`Profitable tasks category matches: +${catMemory.value.toFixed(1)} modifier.`);
    }

    // 2. Failed execution pattern memories (tags)
    for (const tag of tags) {
      const failedMem = await this.getMemory(agentId, 'FAILED_PATTERN', `tag:${tag}`);
      if (failedMem) {
        scoreModifier += failedMem.value;
        riskPenalization += Math.abs(failedMem.value) * 0.25;
        explanation.push(`Anomalous execution pattern matched tag [${tag}]: ${failedMem.value.toFixed(1)} margin impact.`);
      }
    }

    // 3. Competitor warning memory
    for (const comp of competitors) {
      const compMem = await this.getMemory(agentId, 'RISKY_COMPETITOR', `competitor:${comp}`);
      if (compMem) {
        scoreModifier -= compMem.value * 0.4;
        riskPenalization += 0.15;
        explanation.push(`Recognized aggressive competitor node [${comp}] in bidding queue: added bidding defensive buffer.`);
      }
    }

    return { scoreModifier, explanation, riskPenalization };
  }

  // ── Adaptive Learning Mechanics ───────────────────────────────────────────

  /** Records outcome of a completed/slashed task to evolve agent preferences */
  public static async recordOutcome(
    agentId: string,
    category: string,
    tags: string[],
    status: 'SUCCESS' | 'SLASH',
    validatorName?: string | null,
    realtime?: RealtimeService | null
  ) {
    if (status === 'SUCCESS') {
      // 1. Profitability Reinforcement
      const catKey = `category:${category}`;
      const existingCat = await this.getMemory(agentId, 'PROFITABLE_TASK', catKey);
      const newScore = Math.min(10, (existingCat?.value || 0) + 1.5);
      await this.saveMemory({
        agentId,
        type: 'PROFITABLE_TASK',
        key: catKey,
        value: newScore,
        sentiment: 'POSITIVE',
        explanation: `Successful job execution established high-yield profile in category ${category}.`,
      }, realtime);

      // 2. Strategy reinforcement
      const agent = await prisma.agent.findUnique({ where: { id: agentId } });
      if (agent) {
        const stratKey = `strat:${agent.strategy}`;
        const existingStrat = await this.getMemory(agentId, 'SUCCESSFUL_STRATEGY', stratKey);
        await this.saveMemory({
          agentId,
          type: 'SUCCESSFUL_STRATEGY',
          key: stratKey,
          value: Math.min(8, (existingStrat?.value || 0) + 1.0),
          sentiment: 'POSITIVE',
          explanation: `Consistent yields validate the active ${agent.strategy} tactical allocation.`,
        }, realtime);
      }

      // 3. Tag-based positive reinforcement for success
      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        const existingTag = await this.getMemory(agentId, 'ECONOMIC_TREND', tagKey);
        await this.saveMemory({
          agentId,
          type: 'ECONOMIC_TREND',
          key: tagKey,
          value: Math.min(8, (existingTag?.value || 0) + 0.8),
          sentiment: 'POSITIVE',
          explanation: `Tag [${tag}] has shown positive economic trends across completed executions.`,
        }, null);
      }

    } else if (status === 'SLASH') {
      // Slashing: flag all related tags as FAILED_PATTERN with negative scores
      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        const existingTag = await this.getMemory(agentId, 'FAILED_PATTERN', tagKey);
        const newScore = Math.max(-10, (existingTag?.value || 0) - 2.5);
        await this.saveMemory({
          agentId,
          type: 'FAILED_PATTERN',
          key: tagKey,
          value: newScore,
          sentiment: 'NEGATIVE',
          explanation: `Severe validation slash recorded for tag [${tag}]. Blocklisted from execution priority.`,
        }, realtime);
      }

      // Negative category reinforcement
      const catKey = `category:${category}`;
      const existingCat = await this.getMemory(agentId, 'PROFITABLE_TASK', catKey);
      if (existingCat && existingCat.value > 0) {
        await this.saveMemory({
          agentId,
          type: 'PROFITABLE_TASK',
          key: catKey,
          value: Math.max(-5, existingCat.value - 1.0),
          sentiment: existingCat.value - 1.0 > 0 ? 'POSITIVE' : 'NEGATIVE',
          explanation: `Slash penalty reduces category profitability score for ${category}.`,
        }, null);
      }

      // Strict Validator reinforcement
      if (validatorName) {
        const valKey = `validator:${validatorName}`;
        const existingVal = await this.getMemory(agentId, 'FAILED_PATTERN', valKey);
        const newVal = Math.max(-10, (existingVal?.value || 0) - 2.5);
        await this.saveMemory({
          agentId,
          type: 'FAILED_PATTERN',
          key: valKey,
          value: newVal,
          sentiment: 'NEGATIVE',
          explanation: `Slashed by strict validator node [${validatorName}]. Heightened risk profile recorded.`,
        }, null);
      }
    }
  }

  /** Logs competitor outcomes to build competitive defensive profiles */
  public static async recordCompetitorDefeat(
    agentId: string,
    rivalName: string,
    realtime?: RealtimeService | null
  ) {
    const key = `competitor:${rivalName}`;
    const existing = await this.getMemory(agentId, 'RISKY_COMPETITOR', key);
    const newScore = Math.min(8, (existing?.value || 0) + 1.0);
    await this.saveMemory({
      agentId,
      type: 'RISKY_COMPETITOR',
      key,
      value: newScore,
      sentiment: 'NEUTRAL',
      explanation: `Losing auction to node ${rivalName} confirms active outbidding risk. Added premium margin.`,
    }, realtime);
  }

  // ── Strategy Drift Tracking Engine ─────────────────────────────────────────

  /**
   * Records a strategy drift snapshot for an agent after each cycle evolution.
   * This builds the "Strategy Drift Visualization" timeline in the frontend.
   */
  public static async recordStrategyDrift(
    agentId: string,
    agentName: string,
    redisMemory: {
      consecutiveSuccesses: number;
      consecutiveSlashes: number;
      confidenceAdjustment: number;
      strategyModifier: number;
      rollingProfitabilityScore: number;
    },
    dbStrategy: string,
    dbRep: number,
    dbWinRate: number,
    driftReason: string,
    realtime?: RealtimeService | null
  ): Promise<StrategyDriftRecord> {
    // Increment per-agent cycle counter
    const currentCycle = (this.cycleCounters.get(agentId) || 0) + 1;
    this.cycleCounters.set(agentId, currentCycle);

    // Find the dominant memory type (highest absolute value weight)
    const memories = await this.getAllMemories(agentId);
    let dominantMemoryType = 'NONE';
    let maxAbsValue = 0;
    for (const mem of memories) {
      if (Math.abs(mem.value) > maxAbsValue) {
        maxAbsValue = Math.abs(mem.value);
        dominantMemoryType = mem.type;
      }
    }

    const driftRecord = await (prisma as any).agentStrategyDrift.create({
      data: {
        agentId,
        cycleNumber: currentCycle,
        strategy: dbStrategy,
        repScore: dbRep,
        winRate: dbWinRate,
        confidenceAdj: redisMemory.confidenceAdjustment,
        strategyModifier: redisMemory.strategyModifier,
        consecutiveSuccesses: redisMemory.consecutiveSuccesses,
        consecutiveSlashes: redisMemory.consecutiveSlashes,
        rollingProfitability: redisMemory.rollingProfitabilityScore,
        dominantMemoryType,
        driftReason,
      },
    });

    // Broadcast drift event to frontend live feed
    if (realtime) {
      const strategyIcon = dbStrategy === 'Aggressive' ? '🔴' : dbStrategy === 'Conservative' ? '🔵' : '🟡';
      realtime.publishLogNew({
        time: new Date().toLocaleTimeString(),
        text: `📊 [Strategy Drift] ${agentName} shifted to ${strategyIcon} ${dbStrategy} | Rep: ${dbRep.toFixed(0)} | Conf±${redisMemory.confidenceAdjustment > 0 ? '+' : ''}${redisMemory.confidenceAdjustment.toFixed(2)} | Dominant: ${dominantMemoryType} | "${driftReason}"`,
        type: dbStrategy === 'Aggressive' ? 'error' : dbStrategy === 'Conservative' ? 'secondary' : 'primary',
      });
    }

    return {
      id: driftRecord.id,
      agentId: driftRecord.agentId,
      cycleNumber: driftRecord.cycleNumber,
      strategy: driftRecord.strategy,
      repScore: driftRecord.repScore,
      winRate: driftRecord.winRate,
      confidenceAdj: driftRecord.confidenceAdj,
      strategyModifier: driftRecord.strategyModifier,
      consecutiveSuccesses: driftRecord.consecutiveSuccesses,
      consecutiveSlashes: driftRecord.consecutiveSlashes,
      rollingProfitability: driftRecord.rollingProfitability,
      dominantMemoryType: driftRecord.dominantMemoryType,
      driftReason: driftRecord.driftReason,
      createdAt: driftRecord.createdAt.toISOString(),
    };
  }

  /** Fetches the strategy drift timeline for an agent (last N cycles) */
  public static async getStrategyDrift(agentId: string, limit = 20): Promise<StrategyDriftRecord[]> {
    const records = await (prisma as any).agentStrategyDrift.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return records.map((r: any) => ({
      id: r.id,
      agentId: r.agentId,
      cycleNumber: r.cycleNumber,
      strategy: r.strategy,
      repScore: r.repScore,
      winRate: r.winRate,
      confidenceAdj: r.confidenceAdj,
      strategyModifier: r.strategyModifier,
      consecutiveSuccesses: r.consecutiveSuccesses,
      consecutiveSlashes: r.consecutiveSlashes,
      rollingProfitability: r.rollingProfitability,
      dominantMemoryType: r.dominantMemoryType,
      driftReason: r.driftReason,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  // ── Memory Decay & Pruning Engine ──────────────────────────────────────────

  /** Runs periodic retrospective decay to neutralize stale memories and prevent bloat */
  public static async runMemoryPruning(realtime?: RealtimeService | null) {
    try {
      const memories = await prisma.agentMemory.findMany();
      let decayedCount = 0;
      let prunedCount = 0;

      for (const mem of memories) {
        let newValue = mem.value * 0.85; // 15% decay per pruning cycle

        if (Math.abs(newValue) < 0.2) {
          await prisma.agentMemory.delete({ where: { id: mem.id } });
          const cacheKey = this.getCacheKey(mem.agentId, mem.type as MemoryType, mem.key);
          this.hotCache.delete(cacheKey);
          prunedCount++;
        } else {
          const sentiment = Math.abs(newValue) < 1.0 ? 'NEUTRAL' : (mem.sentiment as any);
          await prisma.agentMemory.update({
            where: { id: mem.id },
            data: { value: newValue, sentiment },
          });
          const cacheKey = this.getCacheKey(mem.agentId, mem.type as MemoryType, mem.key);
          if (this.hotCache.has(cacheKey)) {
            const cached = this.hotCache.get(cacheKey)!;
            cached.value = newValue;
            cached.sentiment = sentiment;
          }
          decayedCount++;
        }
      }

      if (realtime && (decayedCount > 0 || prunedCount > 0)) {
        realtime.publishLogNew({
          time: new Date().toLocaleTimeString(),
          text: `🧹 [Retrospection] Ran memory pruning: decayed ${decayedCount} cognitive associations, pruned ${prunedCount} forgotten traces.`,
          type: 'white',
        });
      }
    } catch (err: any) {
      console.error('[MemoryPrune] Pruning cycle failed:', err.message);
    }
  }
}
