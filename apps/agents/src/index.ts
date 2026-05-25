import dotenv from 'dotenv';
dotenv.config();

import { setupWorkers } from './workers';
import { setupRepeatableJobs } from './queues';

async function bootstrap() {
  console.log('====================================');
  console.log('Taskra Autonomous Agent Engine');
  console.log('Initializing Event-Driven Architecture');
  console.log('====================================');

  setupWorkers();
  await setupRepeatableJobs();

  console.log('Agent Engine is running.');
}

bootstrap().catch(err => {
  console.error('Failed to start agent engine:', err);
  process.exit(1);
});
