import { Queue, ConnectionOptions } from 'bullmq';
import { env } from './env';

export const queueConnection: ConnectionOptions = {
  url: env.REDIS_URL,
  maxRetriesPerRequest: null, // Required by BullMQ
};

// Centralized list of BullMQ Queue instances
export const taskQueue = new Queue('task-queue', {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const bidQueue = new Queue('bid-queue', {
  connection: queueConnection,
});

export const blockchainQueue = new Queue('blockchain-queue', {
  connection: queueConnection,
});

export async function closeQueues() {
  await Promise.all([
    taskQueue.close(),
    bidQueue.close(),
    blockchainQueue.close(),
  ]);
  console.log('BullMQ queues gracefully shutdown.');
}
