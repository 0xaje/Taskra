import Redis from 'ioredis';
import { env } from './env';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Critical requirement for BullMQ compatibility
  enableReadyCheck: true,
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.slice(0, targetError.length) === targetError) {
      return true;
    }
    return false;
  },
});

redis.on('connect', () => {
  console.log('Redis connecting...');
});

redis.on('ready', () => {
  console.log('Redis is ready and connected.');
});

redis.on('error', (err) => {
  console.error('Redis Connection Error:', err);
});

export async function closeRedis() {
  await redis.quit();
  console.log('Redis connection gracefully terminated.');
}
