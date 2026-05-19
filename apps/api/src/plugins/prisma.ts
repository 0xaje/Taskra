import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { prisma, connectDatabase } from '../config/database';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPlugin: FastifyPluginAsync = fp(async (server: FastifyInstance) => {
  await connectDatabase();
  
  server.decorate('prisma', prisma);

  server.addHook('onClose', async (instance: FastifyInstance) => {
    await instance.prisma.$disconnect();
    console.log('Prisma client disconnected.');
  });
});

export default prismaPlugin;
