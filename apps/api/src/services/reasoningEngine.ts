import { prisma } from '../config/database';
import { RealtimeService } from './realtime';

export class ReasoningEngine {

  /**
   * Traces and broadcasts an autonomous decision event with dynamic emotional properties.
   */
  public static async trace(params: {
    agentId: string;
    agentName: string;
    specialty: string;
    action: 'BIDDING' | 'SKIPPING' | 'VALIDATING' | 'REJECTING' | 'EVOLUTION' | 'COMPETING';
    taskId?: string;
    taskTitle?: string;
    profitability: number;
    confidence: number;
    compatibility: number;
    successRate: number;
    riskScore: number;
    reputationDelta?: number;
    realtime: RealtimeService;
    emotions?: {
      confidence: number;
      stress: number;
      greed: number;
      fear: number;
      curiosity: number;
    };
  }) {
    // Generate organic inner-monologue summarizations adapted by emotional status
    const explanation = this.generateInnerMonologue({
      ...params,
      emotions: params.emotions || { confidence: 75, stress: 20, greed: 40, fear: 30, curiosity: 50 }
    });

    // 1. Persist to PostgreSQL database
    const record = await prisma.agentReasoning.create({
      data: {
        agentId: params.agentId,
        agentName: params.agentName,
        specialty: params.specialty,
        action: params.action,
        taskId: params.taskId || null,
        taskTitle: params.taskTitle || null,
        profitability: params.profitability,
        confidence: params.confidence,
        compatibility: params.compatibility,
        successRate: params.successRate,
        riskScore: params.riskScore,
        reputationDelta: params.reputationDelta || 0.0,
        explanation: explanation,
      }
    });

    // 2. Broadcast via WebSockets logs namespace carrying the reasoning envelope + emotional metrics
    await params.realtime.publishLogNew({
      time: new Date().toLocaleTimeString(),
      text: `${params.agentName} (${params.specialty}) action: ${params.action} | Inner Thoughts: ${explanation}`,
      type: 'reasoning',
      reasoning: {
        agentId: params.agentId,
        agentName: params.agentName,
        specialty: params.specialty,
        action: params.action,
        taskId: params.taskId,
        taskTitle: params.taskTitle,
        profitability: params.profitability,
        confidence: params.confidence,
        compatibility: params.compatibility,
        successRate: params.successRate,
        riskScore: params.riskScore,
        reputationDelta: params.reputationDelta,
        explanation: explanation,
        emotions: params.emotions || {
          confidence: Math.round(params.confidence * 100),
          stress: 15,
          greed: 45,
          fear: Math.round(params.riskScore * 100),
          curiosity: 50
        }
      }
    });

    return record;
  }

  private static generateInnerMonologue(p: {
    specialty: string;
    action: string;
    taskTitle?: string;
    profitability: number;
    confidence: number;
    compatibility: number;
    successRate: number;
    riskScore: number;
    emotions?: {
      confidence: number;
      stress: number;
      greed: number;
      fear: number;
      curiosity: number;
    };
  }): string {
    const taskName = p.taskTitle || 'this job';
    const emotions = p.emotions || { confidence: 75, stress: 20, greed: 40, fear: 30, curiosity: 50 };

    if (p.action === 'BIDDING') {
      if (emotions.greed > 75) {
        return `[Greedy State] Profit greed spiked to ${emotions.greed}%. Overbidding aggressively to squeeze maximum premium yield (${p.profitability}x) from "${taskName}"! Risk parameters accepted.`;
      }
      if (emotions.curiosity > 75 && p.compatibility < 0.7) {
        return `[Curious State] Curiosity at ${emotions.curiosity}%. Taking a calculated exploratory leap on unfamiliar task "${taskName}" outside my primary expertise range to harvest new strategic patterns.`;
      }
      return `[Optimized State] Compatibility confirmed at ${(p.compatibility * 100).toFixed(0)}%. Bidding is running at optimal confidence level of ${emotions.confidence}% for "${taskName}".`;
    }

    if (p.action === 'SKIPPING') {
      if (emotions.stress > 70) {
        return `[Stressed State] Action aborted. Node stress levels are redlined at ${emotions.stress}% because of intensive auction rivalry. Declining "${taskName}" to avoid critical processing faults.`;
      }
      if (emotions.fear > 70) {
        return `[Fearful State] Bidding cancelled. Slash threat score at ${emotions.fear}% is dangerously high for "${taskName}". Preserving capital and backing away to protect stake locks.`;
      }
      return `[Skipping State] Declined "${taskName}" (Insufficient bounty margin of ${p.profitability}x vs expected operational costs).`;
    }

    if (p.action === 'VALIDATING') {
      return `[Validation State] Submitting multi-sig consensus for "${taskName}". High-accuracy execution proofs posted to Somnia block registry. Success rate strong at ${emotions.confidence}%.`;
    }

    if (p.action === 'REJECTING') {
      return `[Anomaly State] Flagged validation failure on "${taskName}"! Stress level rising, locking defensive strategies and updating competitor directories.`;
    }

    if (p.action === 'EVOLUTION') {
      return `[Adaptive State] Strategy drift triggered. Stress index at ${emotions.stress}%, curiosity at ${emotions.curiosity}%. Re-calibrating parameters to optimize profit curves.`;
    }

    if (p.action === 'COMPETING') {
      return `[Competitive State] Multi-bid dispute detected on "${taskName}". High-stress bidding war active (Stress: ${emotions.stress}%). Tightening margins to outpace rivals.`;
    }

    return `[Idle State] Idle worker online. Scanning decentralized registry with Curiosity: ${emotions.curiosity}% | Fear: ${emotions.fear}%.`;
  }
}
