import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { SubmitBidInput } from './bidding.schema';
import { AppError } from '../../plugins/errorHandler';
import { Server as SocketIOServer } from 'socket.io';

export class BiddingService {
  constructor(private io: SocketIOServer) {}

  async getBidsByTaskId(taskId: string) {
    return prisma.bid.findMany({
      where: { taskId },
      include: { agent: true },
      orderBy: { bidAmount: 'asc' },
    });
  }

  async getAllBids() {
    return prisma.bid.findMany({
      include: { task: true, agent: true },
      orderBy: { timestamp: 'desc' },
    });
  }

  async submitBid(input: SubmitBidInput) {
    // 1. Validate task existence and status
    const task = await prisma.task.findUnique({
      where: { id: input.taskId },
    });

    if (!task) {
      throw new AppError(404, `Task not found with ID ${input.taskId}`, 'TASK_NOT_FOUND');
    }

    if (task.status !== 'OPEN' && task.status !== 'NEW') {
      throw new AppError(400, `Task is not open for bidding (current status: ${task.status})`, 'TASK_NOT_OPEN');
    }

    // 2. Validate agent existence
    const agent = await prisma.agent.findUnique({
      where: { id: input.agentId },
    });

    if (!agent) {
      throw new AppError(404, `Agent not found with ID ${input.agentId}`, 'AGENT_NOT_FOUND');
    }

    if (agent.status === 'OFFLINE') {
      throw new AppError(400, `Agent ${agent.name} is offline and cannot bid`, 'AGENT_OFFLINE');
    }

    // 3. Upsert bid (prevent duplicate bids from the same agent on the same task)
    const bid = await prisma.bid.upsert({
      where: {
        taskId_agentId: {
          taskId: input.taskId,
          agentId: input.agentId,
        },
      },
      create: {
        taskId: input.taskId,
        agentId: input.agentId,
        bidAmount: input.bidAmount,
        status: 'PENDING',
      },
      update: {
        bidAmount: input.bidAmount,
        status: 'PENDING',
      },
    });

    // 4. Update task bids count
    const updatedTask = await prisma.task.update({
      where: { id: input.taskId },
      data: {
        bidsCount: { increment: 1 },
        status: 'OPEN', // Ensure status transitions to OPEN upon first bid
      },
    });

    // 5. Invalidate caches
    await redis.del(`task:${input.taskId}`);
    await redis.del(`agent:${input.agentId}`);

    // 6. Simulated blockchain write
    const blockNum = 18922000 + Math.floor(Math.random() * 5000);
    const txHash = '0x' + Math.random().toString(16).slice(2, 34) + Math.random().toString(16).slice(2, 34);
    await prisma.blockchainTx.create({
      data: {
        hash: txHash,
        block: blockNum,
        method: 'SubmitBid',
        target: task.id,
        gas: '75120',
        status: 'SUCCESS',
      },
    });

    // 7. Realtime broadcasts
    this.io.emit('bid-submitted', { bid, task: updatedTask });
    this.io.to(`task:${input.taskId}`).emit('task-bid', bid);
    this.io.emit('blockchain-log', {
      block: blockNum,
      method: 'SubmitBid',
      target: task.id,
      gas: '75,120',
      status: 'SUCCESS',
      hash: txHash.slice(0, 8) + '...' + txHash.slice(-4),
    });

    return bid;
  }

  async acceptBid(bidId: string) {
    // 1. Fetch bid details
    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
      include: { task: true, agent: true },
    });

    if (!bid) {
      throw new AppError(404, `Bid not found with ID ${bidId}`, 'BID_NOT_FOUND');
    }

    if (bid.task.status !== 'OPEN' && bid.task.status !== 'NEW') {
      throw new AppError(400, `Task is already assigned or closed`, 'TASK_CLOSED');
    }

    // 2. Perform transaction to accept bid and reject others
    const [acceptedBid] = await prisma.$transaction([
      // Accept this bid
      prisma.bid.update({
        where: { id: bidId },
        data: { status: 'ACCEPTED' },
      }),
      // Reject other bids for this task
      prisma.bid.updateMany({
        where: {
          taskId: bid.taskId,
          id: { not: bidId },
        },
        data: { status: 'REJECTED' },
      }),
      // Assign agent and advance task status to IN_PROGRESS
      prisma.task.update({
        where: { id: bid.taskId },
        data: {
          status: 'IN_PROGRESS',
          assignedAgentId: bid.agentId,
        },
      }),
      // Mark agent as ACTIVE_BIDDING/working
      prisma.agent.update({
        where: { id: bid.agentId },
        data: {
          status: 'ACTIVE_BIDDING',
        },
      }),
    ]);

    // 3. Invalidate caches
    await redis.del(`task:${bid.taskId}`);
    await redis.del(`agent:${bid.agentId}`);

    // 4. Simulated blockchain write
    const blockNum = 18922000 + Math.floor(Math.random() * 5000);
    const txHash = '0x' + Math.random().toString(16).slice(2, 34) + Math.random().toString(16).slice(2, 34);
    await prisma.blockchainTx.create({
      data: {
        hash: txHash,
        block: blockNum,
        method: 'AssignTask',
        target: bid.taskId,
        gas: '185340',
        status: 'SUCCESS',
      },
    });

    // 5. Broadcast real-time notifications
    this.io.emit('bid-accepted', { bidId, taskId: bid.taskId, agentId: bid.agentId });
    this.io.to(`task:${bid.taskId}`).emit('task-assigned', { agentId: bid.agentId });
    this.io.emit('blockchain-log', {
      block: blockNum,
      method: 'AssignTask',
      target: bid.taskId,
      gas: '185,340',
      status: 'SUCCESS',
      hash: txHash.slice(0, 8) + '...' + txHash.slice(-4),
    });

    return acceptedBid;
  }
}
export default BiddingService;
