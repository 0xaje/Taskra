import { Worker, Job } from 'bullmq';
import { queueConnection } from '../config/bullmq';
import { prisma } from '../config/database';
import { BiddingService } from '../modules/bidding/bidding.service';
import { Server as SocketIOServer } from 'socket.io';
import { Agent } from '@prisma/client';

export function startTaskWorker(io: SocketIOServer) {
  const biddingService = new BiddingService(io);

  const worker = new Worker(
    'task-queue',
    async (job: Job) => {
      console.log(`Processing BullMQ job [${job.id}] - Name: ${job.name}`);

      if (job.name === 'simulate-agent-bids') {
        const { taskId } = job.data;
        
        // 1. Fetch the task
        const task = await prisma.task.findUnique({
          where: { id: taskId },
        });

        if (!task) {
          console.warn(`[simulate-agent-bids] Task ${taskId} not found. Skipping.`);
          return;
        }

        if (task.status !== 'OPEN' && task.status !== 'NEW') {
          console.warn(`[simulate-agent-bids] Task ${taskId} is not open (status: ${task.status}). Skipping.`);
          return;
        }

        // 2. Find matching agents
        const agents = await prisma.agent.findMany({
          where: {
            status: { in: ['IDLE_SCANNING', 'ACTIVE_BIDDING'] },
          },
        });

        const matchedAgents = agents.filter((agent: Agent) => {
          if (agent.specialty === 'Security Auditor' && task.category === 'Security') return true;
          if (agent.specialty === 'Data Analyst' && task.category === 'Data Mining') return true;
          if (agent.specialty === 'Arb Specialist' && task.category === 'Strategy') return true;
          if (agent.specialty === 'Node Latency Tester' && task.category === 'Infrastructure') return true;
          return false;
        });

        if (matchedAgents.length === 0) {
          console.log(`[simulate-agent-bids] No matching agents for task "${task.title}"`);
          return;
        }

        console.log(`[simulate-agent-bids] Found ${matchedAgents.length} matched agents for task "${task.title}". Submitting simulated bids...`);

        // 3. For each matching agent, submit a bid
        for (const agent of matchedAgents) {
          // Calculate a bid amount based on the reward and strategy
          let bidMultiplier = 0.95; // Balanced default
          if (agent.strategy === 'Conservative') {
            bidMultiplier = 0.98; // wants more reward
          } else if (agent.strategy === 'Aggressive') {
            bidMultiplier = 0.90; // competitive bidding
          }

          const bidAmount = Number(task.reward) * bidMultiplier;

          try {
            console.log(`[simulate-agent-bids] Submitting bid of ${bidAmount} ${task.rewardType} for Agent ${agent.name}`);
            await biddingService.submitBid({
              taskId: task.id,
              agentId: agent.id,
              bidAmount: parseFloat(bidAmount.toFixed(4)),
            });
          } catch (bidError: any) {
            console.error(`[simulate-agent-bids] Failed to submit bid for Agent ${agent.name}:`, bidError.message);
          }
        }
      }
    },
    {
      connection: queueConnection,
    }
  );

  worker.on('completed', (job) => {
    console.log(`BullMQ job [${job.id}] completed successfully.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`BullMQ job [${job ? job.id : 'unknown'}] failed:`, err);
  });

  return worker;
}
