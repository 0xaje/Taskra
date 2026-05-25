import { create } from 'zustand';
import { Task, Agent, SystemEventLog, SystemStats } from '@taskra/types';

interface TaskStore {
  tasks: Task[];
  agents: Agent[];
  events: SystemEventLog[];
  stats: SystemStats | null;
  latencies: Record<string, number>; // NS -> latency in ms
  connectionStates: Record<string, 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING'>;
  volatility: number;

  setTasks: (tasks: Task[]) => void;
  setAgents: (agents: Agent[]) => void;
  addEvent: (event: SystemEventLog) => void;
  upsertTask: (task: Task) => void;
  upsertAgent: (agent: Agent) => void;
  setStats: (stats: SystemStats) => void;
  setLatency: (ns: string, latency: number) => void;
  setConnectionState: (ns: string, state: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING') => void;
  setVolatility: (volatility: number) => void;
}

const normalizeAgent = (a: Agent): Agent => ({
  ...a,
  earningsETH: Number(a.earningsETH || 0),
  earningsUSDC: Number(a.earningsUSDC || 0),
  stakeLocked: Number(a.stakeLocked || 0),
  collateralSlashHistory: Number(a.collateralSlashHistory || 0),
});

const normalizeTask = (t: Task): Task => ({
  ...t,
  reward: Number(t.reward || 0),
});

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  agents: [],
  events: [],
  stats: null,
  latencies: {
    tasks: 0,
    agents: 0,
    logs: 0,
    economy: 0,
  },
  connectionStates: {
    tasks: 'DISCONNECTED',
    agents: 'DISCONNECTED',
    logs: 'DISCONNECTED',
    economy: 'DISCONNECTED',
  },
  volatility: 25,

  setTasks: (tasks) => set({ tasks: tasks.map(normalizeTask) }),
  setAgents: (agents) => set({ agents: agents.map(normalizeAgent) }),
  
  addEvent: (event) => set((state) => {
    // Prevent duplicate logs if they arrive through replay and live feeds
    const exists = state.events.some(
      (e) => e.text === event.text && Math.abs(new Date(e.time).getTime() - new Date(event.time).getTime()) < 2000
    );
    if (exists) return state;

    return {
      events: [event, ...state.events].slice(0, 50),
    };
  }),

  upsertTask: (task) => set((state) => {
    const normalized = normalizeTask(task);
    const exists = state.tasks.some((t) => t.id === normalized.id);
    if (exists) {
      return {
        tasks: state.tasks.map((t) => (t.id === normalized.id ? normalized : t)),
      };
    }
    return {
      tasks: [normalized, ...state.tasks],
    };
  }),

  upsertAgent: (agent) => set((state) => {
    const normalized = normalizeAgent(agent);
    const exists = state.agents.some((a) => a.id === normalized.id);
    if (exists) {
      return {
        agents: state.agents.map((a) => (a.id === normalized.id ? normalized : a)),
      };
    }
    return {
      agents: [...state.agents, normalized],
    };
  }),

  setStats: (stats) => set({ stats }),

  setLatency: (ns, latency) => set((state) => ({
    latencies: { ...state.latencies, [ns]: latency },
  })),

  setConnectionState: (ns, connectionState) => set((state) => ({
    connectionStates: { ...state.connectionStates, [ns]: connectionState },
  })),

  setVolatility: (volatility) => set({ volatility }),
}));
export type { Task, Agent, SystemEventLog, SystemStats };
