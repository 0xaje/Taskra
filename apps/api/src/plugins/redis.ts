import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import { redis, closeRedis } from '../config/redis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPlugin: FastifyPluginAsync = fp(async (server: FastifyInstance) => {
  server.decorate('redis', redis);

  server.addHook('onClose', async () => {
    await closeRedis();
  });
});

export default redisPlugin;
