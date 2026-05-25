import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { env } from '../config/env';
import { RealtimeService } from '../services/realtime';

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
    realtime: RealtimeService;
    broadcast: (event: string, data: any) => void;
  }
}

const websocketPlugin: FastifyPluginAsync = fp(async (server: FastifyInstance) => {
  // 1. Initialize the Socket.io Server instance
  const io = new SocketIOServer(server.server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    // Heartbeat System: custom settings to detect client disconnection promptly
    pingInterval: 15000, // Send ping every 15 seconds
    pingTimeout: 5000,   // Disconnect client if no pong within 5 seconds
  });

  // 2. Setup Redis adapter for scalable broadcasting (if Redis url is available)
  let pubClient: Redis | null = null;
  let subClient: Redis | null = null;
  
  try {
    pubClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
    subClient = pubClient.duplicate();

    io.adapter(createAdapter(pubClient, subClient));
    server.log.info('Socket.io Redis adapter successfully initialized.');
  } catch (err: any) {
    server.log.error(`Failed to initialize Socket.io Redis adapter: ${err.message}. Running in fallback in-memory mode.`);
  }

  // 3. Initialize the RealtimeService with the initialized io instance and redis instance
  const realtimeService = new RealtimeService(io, server.redis);

  // 4. Decorate Fastify Instance with io, realtime, and helper functions
  server.decorate('io', io);
  server.decorate('realtime', realtimeService);
  
  // Legacy broadcast wrapper mapping to root namespace (for backward compatibility if needed)
  server.decorate('broadcast', (event: string, data: any) => {
    io.emit(event, data);
  });

  // 5. Setup Graceful Shutdown Hook
  server.addHook('onClose', async () => {
    server.log.warn('Shutting down WebSocket gateway and closing adapters...');
    
    // Close the Socket.io server
    await new Promise<void>((resolve) => {
      io.close(() => {
        resolve();
      });
    });

    // Close the Pub/Sub Redis clients if they were created
    const quitPromises: Promise<any>[] = [];
    if (pubClient) quitPromises.push(pubClient.quit());
    if (subClient) quitPromises.push(subClient.quit());
    await Promise.all(quitPromises);

    server.log.info('WebSocket and Redis pub/sub adapters successfully closed.');
  });
});

export default websocketPlugin;
export { RealtimeService };
