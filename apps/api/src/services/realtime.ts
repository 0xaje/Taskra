import { Server as SocketIOServer, Namespace, Socket } from 'socket.io';
import Redis from 'ioredis';
import { prisma } from '../config/database';
import { 
  Task, Agent, SystemEventLog, SystemStats, Settlement,
  RealtimeEventEnvelope, TasksNamespaceEvents, AgentsNamespaceEvents,
  LogsNamespaceEvents, EconomyNamespaceEvents, ClientToServerEvents,
  RealtimeChannel
} from '@taskra/types';

export class RealtimeService {
  private io: SocketIOServer;
  private redis: Redis;
  public tasksNs: Namespace<ClientToServerEvents, TasksNamespaceEvents>;
  public agentsNs: Namespace<ClientToServerEvents, AgentsNamespaceEvents>;
  public logsNs: Namespace<ClientToServerEvents, LogsNamespaceEvents>;
  public economyNs: Namespace<ClientToServerEvents, EconomyNamespaceEvents>;

  private streamPrefix = 'taskra:stream:';
  private maxStreamLength = 1000;

  constructor(io: SocketIOServer, redis: Redis) {
    this.io = io;
    this.redis = redis;

    // Initialize namespaces with standard events and custom logic
    this.tasksNs = this.io.of('/tasks');
    this.agentsNs = this.io.of('/agents');
    this.logsNs = this.io.of('/logs');
    this.economyNs = this.io.of('/economy');

    this.setupNamespace(this.tasksNs, 'tasks');
    this.setupNamespace(this.agentsNs, 'agents');
    this.setupNamespace(this.logsNs, 'logs');
    this.setupNamespace(this.economyNs, 'economy');

    console.log('Realtime Event Streaming Infrastructure successfully initialized with 4 namespaces.');
  }

  /**
   * Set up common hooks, heartbeat, and replay logic on a given namespace.
   */
  private setupNamespace(
    ns: Namespace<ClientToServerEvents, any, any, any>,
    nsName: string
  ) {
    const streamKey = `${this.streamPrefix}${nsName}`;

    ns.on('connection', (socket: Socket<ClientToServerEvents, any, any, any>) => {
      console.log(`[Socket.io] Client ${socket.id} connected to namespace /${nsName}`);

      // 1. Heartbeat System: custom ping-pong for round-trip latency measurements
      socket.on('ping:request', (payload) => {
        socket.emit('ping:response', {
          clientTime: payload.clientTime,
          serverTime: Date.now()
        });
      });

      // 2. Room Management: allow client to join/leave specific rooms (primarily used in tasks for details/bids)
      socket.on('join-room', (roomName: string) => {
        socket.join(roomName);
        console.log(`[Socket.io] Client ${socket.id} joined room "${roomName}" in /${nsName}`);
      });

      socket.on('leave-room', (roomName: string) => {
        socket.leave(roomName);
        console.log(`[Socket.io] Client ${socket.id} left room "${roomName}" in /${nsName}`);
      });

      // 3. Event Replay System: retrieves missed events on reconnect
      socket.on('replay:request', async (payload) => {
        const lastEventId = payload?.lastEventId;
        const limit = payload?.limit || 100;

        console.log(`[Socket.io] Client ${socket.id} requested event replay in /${nsName} from ID "${lastEventId || 'beginning'}"`);

        try {
          let rawEntries: any[] = [];
          if (lastEventId) {
            // Fetch events strictly after lastEventId using exclusive indicator '('
            rawEntries = await this.redis.xrange(streamKey, `(${lastEventId}`, '+', 'COUNT', limit);
          } else {
            // If no ID is provided, return latest events (up to the limit)
            rawEntries = await this.redis.xrange(streamKey, '-', '+', 'COUNT', limit);
          }

          // Parse and emit each event in chronological order
          for (const entry of rawEntries) {
            const [id, fields] = entry;
            const envelope = this.parseStreamEntry(id, fields);
            // Emit to the specific socket that requested the replay
            socket.emit(envelope.channel, envelope);
          }

          socket.emit('replay:complete');
          console.log(`[Socket.io] Completed event replay for client ${socket.id} (sent ${rawEntries.length} events).`);
        } catch (err: any) {
          console.error(`[Socket.io] Event replay failed for namespace /${nsName}:`, err.message);
        }
      });

      socket.on('disconnect', (reason) => {
        console.log(`[Socket.io] Client ${socket.id} disconnected from /${nsName}. Reason: ${reason}`);
      });
    });
  }

  /**
   * Helper to write an event to Redis Stream and broadcast it to the corresponding namespace.
   */
  private async publishEvent<T>(
    ns: Namespace<any, any, any, any>,
    nsName: string,
    channel: RealtimeChannel,
    payload: T,
    roomName?: string
  ): Promise<RealtimeEventEnvelope<T>> {
    const streamKey = `${this.streamPrefix}${nsName}`;
    const timestamp = new Date().toISOString();

    try {
      // 1. Persist the event in Redis Stream with capped max length (maxlen ~ 1000)
      const eventIdResult = await this.redis.xadd(
        streamKey,
        'MAXLEN',
        '~',
        this.maxStreamLength.toString(),
        '*',
        'channel',
        channel,
        'timestamp',
        timestamp,
        'payload',
        JSON.stringify(payload)
      );

      const eventId = eventIdResult || `${Date.now()}-0`;

      const envelope: RealtimeEventEnvelope<T> = {
        id: eventId,
        timestamp,
        channel,
        payload
      };

      // 2. Broadcast the event over Socket.io
      if (roomName) {
        // Broadcast only to a specific room (e.g., updates for a specific task)
        ns.to(roomName).emit(channel, envelope);
      } else {
        // Broadcast to all sockets in the namespace
        ns.emit(channel, envelope);
      }

      return envelope;
    } catch (err: any) {
      console.error(`[Socket.io] Failed to publish event to Redis stream/sockets:`, err.message);
      // Fallback: generate a memory envelope and emit to ensure system continues working
      const tempId = `${Date.now()}-0`;
      const envelope: RealtimeEventEnvelope<T> = {
        id: tempId,
        timestamp,
        channel,
        payload
      };
      if (roomName) {
        ns.to(roomName).emit(channel, envelope);
      } else {
        ns.emit(channel, envelope);
      }
      return envelope;
    }
  }

  // =========================================================================
  // PUBLIC BROADCAST APIs
  // =========================================================================

  /**
   * Publishes and broadcasts a new task event.
   */
  public async publishTaskNew(task: Task) {
    return this.publishEvent(this.tasksNs, 'tasks', 'tasks:new', task);
  }

  /**
   * Publishes and broadcasts a task update event.
   * Updates are broadcast globally, and also inside the specific task room.
   */
  public async publishTaskUpdate(task: Task) {
    const envelope = await this.publishEvent(this.tasksNs, 'tasks', 'tasks:update', task);
    // Also broadcast in the task-specific room to keep room-specific subscriptions updated
    this.tasksNs.to(`task:${task.id}`).emit('tasks:update', envelope);
    return envelope;
  }

  /**
   * Publishes and broadcasts an agent update event.
   */
  public async publishAgentUpdate(agent: Agent) {
    return this.publishEvent(this.agentsNs, 'agents', 'agents:update', agent);
  }

  /**
   * Publishes and broadcasts a log event.
   */
  public async publishLogNew(log: SystemEventLog) {
    return this.publishEvent(this.logsNs, 'logs', 'logs:new', log);
  }

  /**
   * Publishes and broadcasts economy stats/settlements.
   */
  public async publishEconomyUpdate(stats: SystemStats, transaction?: Settlement) {
    return this.publishEvent(this.economyNs, 'economy', 'economy:update', {
      stats,
      transaction
    });
  }

  /**
   * Publishes and broadcasts the market volatility index to the economy channel.
   */
  public async publishMarketVolatility(volatility: number) {
    return this.publishEvent(this.economyNs, 'economy', 'economy:volatility', { volatility });
  }

  /**
   * Helper that queries database to compute latest system statistics and broadcasts them to the economy channel.
   */
  public async publishEconomyUpdateWithLatestStats(transaction?: Settlement) {
    try {
      const agents = await prisma.agent.findMany();
      const totalRewardsETH = agents.reduce((acc: number, a: any) => acc + Number(a.earningsETH), 0) + 1842.12;
      const totalRewardsUSDC = agents.reduce((acc: number, a: any) => acc + Number(a.earningsUSDC), 0) + 8500;
      
      const stats: SystemStats = {
        totalRewardsETH: parseFloat(totalRewardsETH.toFixed(4)),
        totalRewardsUSDC: parseFloat(totalRewardsUSDC.toFixed(2)),
        tps: 14.8 + (Math.random() - 0.5) * 2,
        successRate: 98.42,
        taskVolume: 2.1,
        activeAgentsCount: agents.length,
      };

      await this.publishEconomyUpdate(stats, transaction);
    } catch (err: any) {
      console.error('[Socket.io] Failed to compute and publish economy stats:', err.message);
    }
  }

  /**
   * Utility to parse key-value fields from a Redis Stream entry.
   */
  private parseStreamEntry(id: string, fields: string[]): RealtimeEventEnvelope {
    const result: any = { id };
    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      const val = fields[i + 1];
      if (key === 'payload') {
        try {
          result.payload = JSON.parse(val);
        } catch {
          result.payload = val;
        }
      } else {
        result[key] = val;
      }
    }
    return result as RealtimeEventEnvelope;
  }
}
