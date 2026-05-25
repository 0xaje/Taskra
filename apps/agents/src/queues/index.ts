import { Queue, DefaultJobOptions } from 'bullmq';
import { connection } from '../config/redis';

const defaultJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: true,
  removeOnFail: false,
};

export const queues = {
  discovery: new Queue('discovery-queue', { connection, defaultJobOptions }),
  taskGeneration: new Queue('task-generation-queue', { connection, defaultJobOptions }),
  bidding: new Queue('bidding-queue', { connection, defaultJobOptions }),
  execution: new Queue('execution-queue', { connection, defaultJobOptions }),
  validation: new Queue('validation-queue', { connection, defaultJobOptions }),
};

export async function setupRepeatableJobs() {
  await queues.discovery.add('poll-events', {}, {
    repeat: {
      every: 10000,
    }
  });
  console.log('Repeatable discovery job added.');
}
