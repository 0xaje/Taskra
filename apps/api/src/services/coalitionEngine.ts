import { prisma } from '../config/database';
import { RealtimeService } from './realtime';

// ─── Coalition Configuration ─────────────────────────────────────────────────

type CoalitionRole = 'LEAD' | 'SUPPORT' | 'VALIDATOR' | 'AUDITOR';

interface TeamBlueprint {
  roles: { specialty: string; role: CoalitionRole; rewardShare: number }[];
  subtaskTemplates: { agentSpecialty: string; title: string; description: string }[];
  minTeamSize: number;
  collaborationBonus: number; // reward multiplier when coalition succeeds
  description: string;
}

const COALITION_BLUEPRINTS: Record<string, TeamBlueprint> = {
  Security: {
    roles: [
      { specialty: 'AuditAgent',       role: 'LEAD',      rewardShare: 0.45 },
      { specialty: 'RiskAnalystAgent',  role: 'VALIDATOR', rewardShare: 0.30 },
      { specialty: 'ResearchAgent',     role: 'SUPPORT',   rewardShare: 0.25 },
    ],
    subtaskTemplates: [
      { agentSpecialty: 'AuditAgent',      title: 'Static Contract Analysis',         description: 'Scan all smart contract bytecode for reentrancy, overflow, and access-control flaws.' },
      { agentSpecialty: 'RiskAnalystAgent', title: 'Risk Exposure Quantification',    description: 'Model exploitability likelihood and financial exposure across identified vulnerability vectors.' },
      { agentSpecialty: 'ResearchAgent',   title: 'Threat Intelligence Research',     description: 'Cross-reference vulnerability patterns with known exploit databases and DeFi incident reports.' },
    ],
    minTeamSize: 2,
    collaborationBonus: 1.18,
    description: 'Multi-layered security audit coalition combining static analysis, risk modeling, and threat intelligence.',
  },
  DeFi: {
    roles: [
      { specialty: 'ArbitrageAgent',   role: 'LEAD',      rewardShare: 0.40 },
      { specialty: 'RiskAnalystAgent', role: 'AUDITOR',   rewardShare: 0.35 },
      { specialty: 'ValidatorAgent',   role: 'VALIDATOR', rewardShare: 0.25 },
    ],
    subtaskTemplates: [
      { agentSpecialty: 'ArbitrageAgent',   title: 'Liquidity Route Optimization',  description: 'Identify and model optimal liquidity routing paths for maximum arbitrage yield extraction.' },
      { agentSpecialty: 'RiskAnalystAgent', title: 'MEV & Slippage Risk Analysis',  description: 'Quantify MEV exposure, sandwich risk, and acceptable slippage thresholds.' },
      { agentSpecialty: 'ValidatorAgent',   title: 'Transaction Consensus Audit',   description: 'Co-verify transaction ordering and confirm execution integrity before on-chain submission.' },
    ],
    minTeamSize: 2,
    collaborationBonus: 1.22,
    description: 'DeFi liquidity coalition optimizing routes under MEV pressure with consensus validation.',
  },
  Strategy: {
    roles: [
      { specialty: 'ResearchAgent',    role: 'LEAD',      rewardShare: 0.50 },
      { specialty: 'ValidatorAgent',   role: 'AUDITOR',   rewardShare: 0.30 },
      { specialty: 'RiskAnalystAgent', role: 'SUPPORT',   rewardShare: 0.20 },
    ],
    subtaskTemplates: [
      { agentSpecialty: 'ResearchAgent',    title: 'Economic Signal Synthesis',     description: 'Aggregate and model multi-chain economic signals to form strategic allocation hypothesis.' },
      { agentSpecialty: 'ValidatorAgent',   title: 'Hypothesis Verification',       description: 'Independently verify research conclusions against historical on-chain data sets.' },
      { agentSpecialty: 'RiskAnalystAgent', title: 'Downside Scenario Modelling',   description: 'Model tail-risk scenarios and stress-test proposed strategy under adverse conditions.' },
    ],
    minTeamSize: 2,
    collaborationBonus: 1.15,
    description: 'Strategic research coalition synthesizing economic signals with adversarial verification.',
  },
  Infrastructure: {
    roles: [
      { specialty: 'SpeedAgent',       role: 'LEAD',      rewardShare: 0.40 },
      { specialty: 'MonitoringAgent',  role: 'SUPPORT',   rewardShare: 0.35 },
      { specialty: 'ValidatorAgent',   role: 'VALIDATOR', rewardShare: 0.25 },
    ],
    subtaskTemplates: [
      { agentSpecialty: 'SpeedAgent',      title: 'Network Throughput Optimization', description: 'Profile and optimize block relay latency, mempool routing, and gas parameter calibration.' },
      { agentSpecialty: 'MonitoringAgent', title: 'Telemetry & Congestion Diagnostics', description: 'Collect real-time telemetry from validator nodes and surface congestion bottlenecks.' },
      { agentSpecialty: 'ValidatorAgent',  title: 'Consensus Configuration Audit',  description: 'Verify consensus parameter changes meet protocol safety thresholds before deployment.' },
    ],
    minTeamSize: 2,
    collaborationBonus: 1.12,
    description: 'Infrastructure optimization coalition for high-throughput, low-latency network operations.',
  },
  'Data Mining': {
    roles: [
      { specialty: 'ResearchAgent',    role: 'LEAD',      rewardShare: 0.45 },
      { specialty: 'MonitoringAgent',  role: 'SUPPORT',   rewardShare: 0.30 },
      { specialty: 'ArbitrageAgent',   role: 'AUDITOR',   rewardShare: 0.25 },
    ],
    subtaskTemplates: [
      { agentSpecialty: 'ResearchAgent',   title: 'Cross-Chain Data Extraction',   description: 'Extract and normalize multi-chain ledger data including state transitions, balances, and event logs.' },
      { agentSpecialty: 'MonitoringAgent', title: 'Streaming Pipeline Monitoring',  description: 'Monitor real-time data ingestion pipelines for anomalies, latency spikes, and data integrity.' },
      { agentSpecialty: 'ArbitrageAgent',  title: 'Anomaly Pattern Detection',      description: 'Identify statistically significant deviations in extracted data that signal economic opportunities.' },
    ],
    minTeamSize: 2,
    collaborationBonus: 1.10,
    description: 'Data mining coalition for cross-chain extraction, monitoring, and anomaly-driven insights.',
  },
};

// ─── Coalition Engine ────────────────────────────────────────────────────────

export class CoalitionEngine {
  // Track active coalitions in memory to avoid duplicates
  private static activeCoalitionTaskIds: Set<string> = new Set();

  /**
   * Attempts to form a coalition for a given task.
   * Only triggers for high-urgency, high-reward tasks.
   * Returns the coalition record if formed, null if skipped.
   */
  public static async attemptCoalitionFormation(
    task: any,
    availableAgents: any[],
    realtime: RealtimeService
  ): Promise<any | null> {
    // Guard: don't form coalitions for already-coalitioned tasks
    if (this.activeCoalitionTaskIds.has(task.id)) return null;

    // Only form coalitions for high-importance or high-urgency tasks (30% probability)
    const isHighValue = Number(task.reward) > 0.5 || task.urgencyScore > 70 || task.economicImportance === 'CRITICAL';
    if (!isHighValue || Math.random() > 0.30) return null;

    const blueprint = COALITION_BLUEPRINTS[task.category as string];
    if (!blueprint) return null;

    // ── Team Formation Logic: match agents by specialty ──────────────────────
    const selectedMembers: { agent: any; role: CoalitionRole; rewardShare: number }[] = [];

    for (const roleSpec of blueprint.roles) {
      const match = availableAgents.find(a =>
        a.specialty === roleSpec.specialty &&
        a.status !== 'BANKRUPT' &&
        a.status !== 'COOLDOWN' &&
        !selectedMembers.some(m => m.agent.id === a.id)
      );
      if (match) {
        selectedMembers.push({ agent: match, role: roleSpec.role, rewardShare: roleSpec.rewardShare });
      }
    }

    // Need at least minTeamSize members
    if (selectedMembers.length < blueprint.minTeamSize) return null;

    this.activeCoalitionTaskIds.add(task.id);

    const totalReward = Number(task.reward);

    // ── Create Coalition Record ───────────────────────────────────────────────
    const coalition = await (prisma as any).agentCoalition.create({
      data: {
        taskId: task.id,
        taskTitle: task.title,
        taskCategory: task.category,
        status: 'FORMING',
        totalReward,
        rewardType: task.rewardType,
      },
    });

    // ── Create Members ────────────────────────────────────────────────────────
    for (const { agent, role, rewardShare } of selectedMembers) {
      const rewardAmount = parseFloat((totalReward * rewardShare).toFixed(6));
      await (prisma as any).coalitionMember.create({
        data: {
          coalitionId: coalition.id,
          agentId: agent.id,
          agentName: agent.name,
          specialty: agent.specialty,
          role,
          rewardShare,
          rewardAmount,
        },
      });
    }

    // ── Decompose Task into Subtasks ──────────────────────────────────────────
    for (const template of blueprint.subtaskTemplates) {
      const assignedMember = selectedMembers.find(m => m.agent.specialty === template.agentSpecialty);
      if (!assignedMember) continue;
      await (prisma as any).coalitionSubtask.create({
        data: {
          coalitionId: coalition.id,
          agentId: assignedMember.agent.id,
          agentName: assignedMember.agent.name,
          title: template.title,
          description: template.description,
          status: 'PENDING',
        },
      });
    }

    // Transition to EXECUTING
    await (prisma as any).agentCoalition.update({
      where: { id: coalition.id },
      data: { status: 'EXECUTING' },
    });

    const memberNames = selectedMembers.map(m => `${m.agent.name} (${m.role})`).join(', ');
    realtime.publishLogNew({
      time: new Date().toLocaleTimeString(),
      text: `🤝 [Coalition Formed] "${task.title}" → ${selectedMembers.length}-agent coalition assembled: [${memberNames}] | Combined escrow: ${totalReward} ${task.rewardType} | Blueprint: ${blueprint.description}`,
      type: 'secondary',
    });

    // Broadcast coalition event to frontend channel
    await this.broadcastCoalitionEvent(coalition.id, 'FORMED', {
      coalitionId: coalition.id,
      taskId: task.id,
      taskTitle: task.title,
      taskCategory: task.category,
      members: selectedMembers.map(m => ({
        agentId: m.agent.id,
        agentName: m.agent.name,
        specialty: m.agent.specialty,
        role: m.role,
        rewardShare: m.rewardShare,
        rewardAmount: parseFloat((totalReward * m.rewardShare).toFixed(6)),
      })),
      totalReward,
      rewardType: task.rewardType,
      status: 'EXECUTING',
    }, realtime);

    return coalition;
  }

  /**
   * Advances all EXECUTING coalitions — simulates subtask completion,
   * co-signing, and shared escrow settlement.
   */
  public static async tickCoalitions(realtime: RealtimeService): Promise<void> {
    const executingCoalitions = await (prisma as any).agentCoalition.findMany({
      where: { status: { in: ['EXECUTING', 'CO_SIGNING'] } },
      include: { members: true, subtasks: true },
    });

    for (const coalition of executingCoalitions) {
      if (coalition.status === 'EXECUTING') {
        await this.advanceExecution(coalition, realtime);
      } else if (coalition.status === 'CO_SIGNING') {
        await this.finalizeCoSigning(coalition, realtime);
      }
    }
  }

  /** Progress subtasks to completion and transition to CO_SIGNING */
  private static async advanceExecution(coalition: any, realtime: RealtimeService): Promise<void> {
    const pendingSubtasks = coalition.subtasks.filter((s: any) => s.status === 'PENDING');
    const inProgressSubtasks = coalition.subtasks.filter((s: any) => s.status === 'IN_PROGRESS');

    // Move pending → in_progress (up to 1 per tick)
    if (pendingSubtasks.length > 0) {
      const subtask = pendingSubtasks[0];
      await (prisma as any).coalitionSubtask.update({
        where: { id: subtask.id },
        data: { status: 'IN_PROGRESS' },
      });
      realtime.publishLogNew({
        time: new Date().toLocaleTimeString(),
        text: `⚙️ [Coalition] Subtask started: "${subtask.title}" → assigned to ${subtask.agentName} (${coalition.taskCategory})`,
        type: 'white',
      });
      return;
    }

    // Complete in_progress subtasks
    if (inProgressSubtasks.length > 0) {
      for (const subtask of inProgressSubtasks) {
        const success = Math.random() > 0.15; // 85% subtask success rate
        await (prisma as any).coalitionSubtask.update({
          where: { id: subtask.id },
          data: { status: success ? 'COMPLETED' : 'FAILED' },
        });
        realtime.publishLogNew({
          time: new Date().toLocaleTimeString(),
          text: `${success ? '✅' : '❌'} [Coalition] Subtask ${success ? 'completed' : 'failed'}: "${subtask.title}" by ${subtask.agentName}`,
          type: success ? 'secondary' : 'error',
        });
      }
      return;
    }

    // All subtasks done — check if overall execution succeeded
    const completedCount = coalition.subtasks.filter((s: any) => s.status === 'COMPLETED').length;
    const totalCount = coalition.subtasks.length;
    const successRate = completedCount / Math.max(1, totalCount);

    if (successRate >= 0.5) {
      // Move to co-signing phase
      await (prisma as any).agentCoalition.update({
        where: { id: coalition.id },
        data: { status: 'CO_SIGNING' },
      });
      realtime.publishLogNew({
        time: new Date().toLocaleTimeString(),
        text: `✍️ [Coalition] Execution complete (${completedCount}/${totalCount} subtasks). Initiating co-signing ceremony for coalition ${coalition.id.slice(0, 8)}...`,
        type: 'primary',
      });
    } else {
      await this.failCoalition(coalition, realtime);
    }
  }

  /** Collect co-signatures and generate the execution proof hash */
  private static async finalizeCoSigning(coalition: any, realtime: RealtimeService): Promise<void> {
    const unsignedMembers = coalition.members.filter((m: any) => !m.signatureHash);

    if (unsignedMembers.length > 0) {
      // Apply one signature per tick
      const member = unsignedMembers[0];
      const sig = '0xSIG' + Math.random().toString(16).slice(2, 18).toUpperCase();
      await (prisma as any).coalitionMember.update({
        where: { id: member.id },
        data: { signatureHash: sig, contributed: true },
      });
      realtime.publishLogNew({
        time: new Date().toLocaleTimeString(),
        text: `✍️ [Co-Sign] ${member.agentName} (${member.role}) co-signed coalition ${coalition.id.slice(0, 8)}... Sig: ${sig.slice(0, 12)}...`,
        type: 'white',
      });
      return;
    }

    // All signed — generate proof hash and settle rewards
    const proofHash = '0xPROOF' + Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();

    const collaborationScore = parseFloat(
      (0.75 + Math.random() * 0.25).toFixed(3)
    );

    await (prisma as any).agentCoalition.update({
      where: { id: coalition.id },
      data: { status: 'SETTLED', executionProofHash: proofHash, collaborationScore },
    });

    // Distribute rewards to each member
    let totalPaid = 0;
    for (const member of coalition.members) {
      const bonus = coalition.totalReward * (COALITION_BLUEPRINTS[coalition.taskCategory]?.collaborationBonus || 1.0);
      const payout = parseFloat((bonus * member.rewardShare).toFixed(6));
      totalPaid += payout;

      const agentData: any = {};
      if (coalition.rewardType === 'ETH') agentData.earningsETH = { increment: payout };
      else agentData.earningsUSDC = { increment: payout };
      agentData.jobsCompleted = { increment: 1 };
      agentData.rep = { increment: 8 }; // coalition success boosts rep

      await prisma.agent.update({ where: { id: member.agentId }, data: agentData });
    }

    // Remove task from active set
    this.activeCoalitionTaskIds.delete(coalition.taskId);

    realtime.publishLogNew({
      time: new Date().toLocaleTimeString(),
      text: `🏆 [Coalition SETTLED] Coalition ${coalition.id.slice(0, 8)}... SETTLED | Proof: ${proofHash.slice(0, 14)}... | Score: ${(collaborationScore * 100).toFixed(1)}% | Total distributed: ${totalPaid.toFixed(4)} ${coalition.rewardType}`,
      type: 'secondary',
    });

    // Broadcast settlement event
    await this.broadcastCoalitionEvent(coalition.id, 'SETTLED', {
      coalitionId: coalition.id,
      taskId: coalition.taskId,
      taskTitle: coalition.taskTitle,
      executionProofHash: proofHash,
      collaborationScore,
      totalReward: coalition.totalReward,
      rewardType: coalition.rewardType,
      members: coalition.members.map((m: any) => ({
        agentId: m.agentId,
        agentName: m.agentName,
        role: m.role,
        rewardShare: m.rewardShare,
        rewardAmount: m.rewardAmount,
        signatureHash: m.signatureHash,
      })),
      status: 'SETTLED',
    }, realtime);
  }

  private static async failCoalition(coalition: any, realtime: RealtimeService): Promise<void> {
    await (prisma as any).agentCoalition.update({
      where: { id: coalition.id },
      data: { status: 'FAILED', collaborationScore: 0 },
    });
    this.activeCoalitionTaskIds.delete(coalition.taskId);
    realtime.publishLogNew({
      time: new Date().toLocaleTimeString(),
      text: `💀 [Coalition FAILED] Coalition ${coalition.id.slice(0, 8)}... — too many subtask failures. Coalition disbanded.`,
      type: 'error',
    });
  }

  /** Broadcast a coalition event to the frontend via logs channel */
  private static async broadcastCoalitionEvent(
    _coalitionId: string,
    eventType: 'FORMED' | 'SETTLED' | 'FAILED',
    payload: any,
    realtime: RealtimeService
  ): Promise<void> {
    // Encode coalition payload as a special log event with __coalition__ prefix for frontend parsing
    realtime.publishLogNew({
      time: new Date().toLocaleTimeString(),
      text: `__COALITION__:${JSON.stringify({ eventType, ...payload })}`,
      type: eventType === 'SETTLED' ? 'secondary' : eventType === 'FAILED' ? 'error' : 'primary',
    });
  }

  /** Fetches recent coalitions for the API endpoint */
  public static async getRecentCoalitions(limit = 20): Promise<any[]> {
    return (prisma as any).agentCoalition.findMany({
      include: { members: true, subtasks: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Fetches coalitions a specific agent has participated in */
  public static async getAgentCoalitions(agentId: string): Promise<any[]> {
    const memberships = await (prisma as any).coalitionMember.findMany({
      where: { agentId },
      include: {
        coalition: {
          include: { members: true, subtasks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return memberships.map((m: any) => m.coalition);
  }
}
