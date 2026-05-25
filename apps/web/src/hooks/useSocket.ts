import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useTaskStore } from '../store/useTaskStore';
import { 
  RealtimeEventEnvelope, Task, Agent, SystemEventLog, SystemStats, Settlement
} from '@taskra/types';

export interface UseSocketReturn {
  sockets: Record<string, Socket>;
  joinTaskRoom: (taskId: string) => void;
  leaveTaskRoom: (taskId: string) => void;
}

export const useSocket = (): UseSocketReturn => {
  const {
    upsertTask,
    upsertAgent,
    addEvent,
    setStats,
    setLatency,
    setConnectionState,
    setVolatility
  } = useTaskStore();

  // Keep references to all namespace sockets
  const socketsRef = useRef<Record<string, Socket>>({});
  
  // Track last processed event IDs for replay on reconnect
  const lastEventIdsRef = useRef<Record<string, string>>({
    tasks: '',
    agents: '',
    logs: '',
    economy: ''
  });

  // Track intervals for heartbeats
  const heartbeatIntervalsRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    console.log(`[Socket.io Client] Connecting namespaces to gateway: ${socketUrl}`);

    const namespaces = ['tasks', 'agents', 'logs', 'economy'];

    namespaces.forEach((ns) => {
      // 1. Establish the namespace connection
      setConnectionState(ns, 'CONNECTING');
      const socket = io(`${socketUrl}/${ns}`, {
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
        reconnectionAttempts: Infinity,
        transports: ['websocket', 'polling']
      });

      socketsRef.current[ns] = socket;

      // 2. Setup Connection Status Observers
      socket.on('connect', () => {
        console.log(`[Socket.io Client] Connected to namespace: /${ns}`);
        setConnectionState(ns, 'CONNECTED');

        addEvent({
          time: new Date().toLocaleTimeString(),
          text: `Gateway Link Established: /${ns}`,
          type: 'primary'
        });

        // 3. Initiate Replay Protocol
        const lastId = lastEventIdsRef.current[ns];
        console.log(`[Socket.io Client] Triggering event replay for /${ns} starting from "${lastId || 'genesis'}"`);
        socket.emit('replay:request', { lastEventId: lastId || undefined, limit: 100 });

        // 4. Start Custom Heartbeat Monitor
        if (heartbeatIntervalsRef.current[ns]) {
          clearInterval(heartbeatIntervalsRef.current[ns]);
        }
        
        heartbeatIntervalsRef.current[ns] = setInterval(() => {
          if (socket.connected) {
            socket.emit('ping:request', { clientTime: Date.now() });
          }
        }, 10000); // Probe latency every 10 seconds
      });

      socket.on('ping:response', (payload: { clientTime: number; serverTime: number }) => {
        const latency = Date.now() - payload.clientTime;
        setLatency(ns, latency);
      });

      socket.on('disconnect', (reason) => {
        console.warn(`[Socket.io Client] Disconnected from namespace: /${ns} | Reason: ${reason}`);
        setConnectionState(ns, 'DISCONNECTED');
        
        addEvent({
          time: new Date().toLocaleTimeString(),
          text: `Gateway Link Broken: /${ns} (Reason: ${reason})`,
          type: 'error'
        });

        if (heartbeatIntervalsRef.current[ns]) {
          clearInterval(heartbeatIntervalsRef.current[ns]);
        }
      });

      socket.on('connect_error', (error) => {
        console.error(`[Socket.io Client] Connection Error on /${ns}:`, error.message);
        setConnectionState(ns, 'RECONNECTING');
      });

      // 4. Namespace Specific Realtime Synchronizers & Stream Replayers
      if (ns === 'tasks') {
        socket.on('tasks:new', (envelope: RealtimeEventEnvelope<Task>) => {
          lastEventIdsRef.current.tasks = envelope.id;
          upsertTask(envelope.payload);
          addEvent({
            time: new Date(envelope.timestamp).toLocaleTimeString(),
            text: `[New Task] ${envelope.payload.title} (Reward: ${envelope.payload.reward} ${envelope.payload.rewardType})`,
            type: 'white'
          });
        });

        socket.on('tasks:update', (envelope: RealtimeEventEnvelope<Task>) => {
          lastEventIdsRef.current.tasks = envelope.id;
          upsertTask(envelope.payload);
          addEvent({
            time: new Date(envelope.timestamp).toLocaleTimeString(),
            text: `[Task Update] Task "${envelope.payload.title}" status changed to ${envelope.payload.status}`,
            type: 'secondary'
          });
        });
      }

      if (ns === 'agents') {
        socket.on('agents:update', (envelope: RealtimeEventEnvelope<Agent>) => {
          lastEventIdsRef.current.agents = envelope.id;
          upsertAgent(envelope.payload);
          addEvent({
            time: new Date(envelope.timestamp).toLocaleTimeString(),
            text: `[Agent Update] Agent "${envelope.payload.name}" updated (Rep: ${envelope.payload.rep}, Win Rate: ${envelope.payload.winRate}%)`,
            type: 'primary'
          });
        });
      }

      if (ns === 'logs') {
        socket.on('logs:new', (envelope: RealtimeEventEnvelope<SystemEventLog>) => {
          lastEventIdsRef.current.logs = envelope.id;
          addEvent(envelope.payload);
        });
      }

      if (ns === 'economy') {
        socket.on('economy:update', (envelope: RealtimeEventEnvelope<{ stats: SystemStats; transaction?: Settlement }>) => {
          lastEventIdsRef.current.economy = envelope.id;
          setStats(envelope.payload.stats);
          
          if (envelope.payload.transaction) {
            const tx = envelope.payload.transaction;
            addEvent({
              time: new Date(envelope.timestamp).toLocaleTimeString(),
              text: `[Escrow Settled] ${tx.amount} ${tx.asset} paid to Agent ${tx.agentId} | Tx: ${tx.txHash.slice(0, 8)}...${tx.txHash.slice(-4)}`,
              type: 'primary'
            });
          }
        });

        socket.on('economy:volatility', (envelope: RealtimeEventEnvelope<{ volatility: number }>) => {
          lastEventIdsRef.current.economy = envelope.id;
          setVolatility(envelope.payload.volatility);
        });
      }
    });

    // Cleanup hook on unmount
    return () => {
      console.log('[Socket.io Client] Tearing down namespace connections...');
      namespaces.forEach((ns) => {
        if (socketsRef.current[ns]) {
          socketsRef.current[ns].disconnect();
        }
        if (heartbeatIntervalsRef.current[ns]) {
          clearInterval(heartbeatIntervalsRef.current[ns]);
        }
      });
    };
  }, [upsertTask, upsertAgent, addEvent, setStats, setLatency, setConnectionState]);

  return {
    sockets: socketsRef.current,
    joinTaskRoom: (taskId: string) => {
      if (socketsRef.current.tasks) {
        socketsRef.current.tasks.emit('join-room', `task:${taskId}`);
      }
    },
    leaveTaskRoom: (taskId: string) => {
      if (socketsRef.current.tasks) {
        socketsRef.current.tasks.emit('leave-room', `task:${taskId}`);
      }
    }
  };
};
