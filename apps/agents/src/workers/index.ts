import { Worker } from 'bullmq';
import { connection } from '../config/redis';
import { DiscoveryAgent } from '../agents/DiscoveryAgent';
import { TaskGeneratorAgent } from '../agents/TaskGeneratorAgent';
import { BiddingAgent } from '../agents/BiddingAgent';
import { ExecutorAgent } from '../agents/ExecutorAgent';
import { ValidatorAgent } from '../agents/ValidatorAgent';

export function setupWorkers() {
  console.log('Setting up BullMQ Workers...');

  const discoveryAgent = new DiscoveryAgent();
  new Worker('discovery-queue', async () => {
    await discoveryAgent.process();
  }, { connection });

  const taskGeneratorAgent = new TaskGeneratorAgent();
  new Worker('task-generation-queue', async job => {
    await taskGeneratorAgent.process(job.data);
  }, { connection, concurrency: 5 });

  const biddingAgent = new BiddingAgent();
  new Worker('bidding-queue', async job => {
    await biddingAgent.process(job.data);
  }, { connection, concurrency: 10 });

  const executorAgent = new ExecutorAgent();
  new Worker('execution-queue', async job => {
    await executorAgent.process(job.data);
  }, { connection, concurrency: 10 });

  const validatorAgent = new ValidatorAgent();
  new Worker('validation-queue', async job => {
    await validatorAgent.process(job.data);
  }, { connection, concurrency: 5 });
  
  console.log('All agent workers are listening to queues.');
}
