import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { CreateTaskInput } from './tasks.schema';
import { AppError } from '../../plugins/errorHandler';
import { taskQueue } from '../../config/bullmq';
import { RealtimeService } from '../../services/realtime';

export class TasksService {
  constructor(private realtime: RealtimeService) {}

  private getCacheKey(id: string): string {
    return `task:${id}`;
  }

  async getAllTasks() {
    return prisma.task.findMany({
      orderBy: { createdAt: 'desc' },
      include: { assignedAgent: true },
    });
  }

  async getTaskById(id: string) {
    const cacheKey = this.getCacheKey(id);

    // 1. Try Cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // 2. Query DB
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedAgent: true,
        bids: {
          include: { agent: true },
        },
      },
    });

    if (!task) {
      throw new AppError(404, `Task not found with ID ${id}`, 'TASK_NOT_FOUND');
    }

    // 3. Cache it (TTL: 30s)
    await redis.setex(cacheKey, 30, JSON.stringify(task));

    return task;
  }

  async createTask(input: CreateTaskInput) {
    // 1. Persist task to database
    const task = await prisma.task.create({
      data: {
        ...input,
        bidsCount: 0,
        status: 'OPEN',
      },
    });

    // 2. Log simulated blockchain action
    const blockNum = 18922000 + Math.floor(Math.random() * 5000);
    const txHash = '0x' + Math.random().toString(16).slice(2, 34) + Math.random().toString(16).slice(2, 34);
    await prisma.blockchainTx.create({
      data: {
        hash: txHash,
        block: blockNum,
        method: 'CreateTask',
        target: task.id,
        gas: '342000',
        status: 'SUCCESS',
      },
    });

    // 3. Broadcast real-time events to all dashboards
    await this.realtime.publishTaskNew(task as any);

    const abbreviatedHash = txHash.slice(0, 8) + '...' + txHash.slice(-4);
    await this.realtime.publishLogNew({
      time: new Date().toLocaleTimeString(),
      text: `CreateTask | Task: ${task.id} | Gas: 342,000 | Tx: ${abbreviatedHash}`,
      type: 'white'
    });

    // 4. Trigger automated background bidding job in BullMQ
    // This starts agent matching, bidding strategy checks, and auto-bids in background workers.
    await taskQueue.add('simulate-agent-bids', { taskId: task.id }, {
      delay: 5000, // delay 5 seconds to simulate agent deliberation
    });

    return task;
  }

  async getTaskLineage(taskId: string) {
    const { TaskEvolutionEngine } = require('../../services/taskEvolutionEngine');
    return TaskEvolutionEngine.getTaskLineage(taskId);
  }
}
export default TasksService;
