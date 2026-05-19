import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { CreateAgentInput, UpdateAgentStatusInput } from './agents.schema';
import { AppError } from '../../plugins/errorHandler';
import { Server as SocketIOServer } from 'socket.io';

export class AgentsService {
  constructor(private io: SocketIOServer) {}

  private getCacheKey(id: string): string {
    return `agent:${id}`;
  }

  async getAllAgents() {
    return prisma.agent.findMany({
      orderBy: { rep: 'desc' },
    });
  }

  async getAgentById(id: string) {
    const cacheKey = this.getCacheKey(id);
    
    // 1. Try Cache
    const cachedAgent = await redis.get(cacheKey);
    if (cachedAgent) {
      return JSON.parse(cachedAgent);
    }

    // 2. Fetch from DB
    const agent = await prisma.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      throw new AppError(404, `Agent not found with ID ${id}`, 'AGENT_NOT_FOUND');
    }

    // 3. Cache it (TTL: 60s)
    await redis.setex(cacheKey, 60, JSON.stringify(agent));

    return agent;
  }

  async createAgent(input: CreateAgentInput) {
    // 1. Check uniqueness of address
    const existing = await prisma.agent.findUnique({
      where: { address: input.address },
    });

    if (existing) {
      throw new AppError(400, `Agent with address ${input.address} already registered`, 'AGENT_EXISTS');
    }

    // 2. Persist
    const agent = await prisma.agent.create({
      data: {
        ...input,
        rep: 750, // baseline
        winRate: 80,
        jobsCompleted: 0,
        earningsETH: 0,
        earningsUSDC: 0,
      },
    });

    // 3. Log on-chain simulation
    const blockNum = 18922000 + Math.floor(Math.random() * 5000);
    const txHash = '0x' + Math.random().toString(16).slice(2, 34) + Math.random().toString(16).slice(2, 34);
    await prisma.blockchainTx.create({
      data: {
        hash: txHash,
        block: blockNum,
        method: 'DeployAgent',
        target: agent.name,
        gas: '1245190',
        status: 'SUCCESS',
      },
    });

    // 4. Broadcast real-time events
    this.io.emit('agent-registered', agent);
    this.io.emit('blockchain-log', {
      block: blockNum,
      method: 'DeployAgent',
      target: agent.name,
      gas: '1,245,190',
      status: 'SUCCESS',
      hash: txHash.slice(0, 8) + '...' + txHash.slice(-4),
    });

    return agent;
  }

  async updateAgentStatus(id: string, input: UpdateAgentStatusInput) {
    const agent = await prisma.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      throw new AppError(404, `Agent not found with ID ${id}`, 'AGENT_NOT_FOUND');
    }

    const updated = await prisma.agent.update({
      where: { id },
      data: input,
    });

    // Invalidate cache
    await redis.del(this.getCacheKey(id));

    // Broadcast update
    this.io.emit('agent-updated', updated);

    return updated;
  }
}
export default AgentsService;
