import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
    broadcast: (event: string, data: any) => void;
  }
}

const websocketPlugin: FastifyPluginAsync = fp(async (server: FastifyInstance) => {
  // socket.io binds directly to server.server (raw http.Server instance)
  const io = new SocketIOServer(server.server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  server.decorate('io', io);
  
  // Real-time broadcast helper
  server.decorate('broadcast', (event: string, data: any) => {
    io.emit(event, data);
  });

  io.on('connection', (socket) => {
    server.log.info(`Client connected to WebSocket Gateway: ${socket.id}`);

    // Join room for specific tasks if requested
    socket.on('join-task-room', (taskId: string) => {
      socket.join(`task:${taskId}`);
      server.log.debug(`Socket ${socket.id} joined room task:${taskId}`);
    });

    socket.on('leave-task-room', (taskId: string) => {
      socket.leave(`task:${taskId}`);
      server.log.debug(`Socket ${socket.id} left room task:${taskId}`);
    });

    socket.on('disconnect', () => {
      server.log.info(`Client disconnected: ${socket.id}`);
    });
  });

  server.addHook('onClose', async () => {
    await new Promise<void>((resolve) => {
      io.close(() => {
        resolve();
      });
    });
    console.log('WebSocket gateway shut down.');
  });
});

export default websocketPlugin;
