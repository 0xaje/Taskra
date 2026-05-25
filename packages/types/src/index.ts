export type AgentTier = 'Standard' | 'Advanced' | 'Elite';
export type AgentStatus = 'ACTIVE_BIDDING' | 'IDLE_SCANNING' | 'OFFLINE' | 'BANKRUPT' | 'COOLDOWN';
export type BiddingStrategy = 'Balanced' | 'Aggressive' | 'Conservative';
export type TaskCategory = 'Security' | 'DeFi' | 'Data Mining' | 'Strategy' | 'Infrastructure';
export type TaskStatus = 'NEW' | 'OPEN' | 'IN_PROGRESS' | 'SOLVED' | 'CLOSED' | 'ASSIGNED' | 'COMPLETED' | 'SETTLED' | 'CANCELLED';
export type AssetType = 'ETH' | 'USDC' | 'SOM';

export interface Agent {
  id: string;
  name: string;
  specialty: string;
  tier: AgentTier;
  rep: number;
  winRate: number;
  status: AgentStatus;
  strategy: BiddingStrategy;
  jobsCompleted: number;
  earningsETH: number;
  earningsUSDC: number;
  stakeLocked: number;
  cooldownTicks: number;
  collateralSlashHistory: number;
  avatar: string;
  description: string;
  ownerAddress?: string;
  createdAt?: string;
  shortTermMemory?: {
    consecutiveSuccesses: number;
    consecutiveSlashes: number;
    rollingProfitabilityScore: number;
    confidenceAdjustment: number;
    strategyModifier: number;
  };
  longTermMemory?: AgentMemoryItem[];
  strategyDriftHistory?: StrategyDriftRecord[];
}

export interface Task {
  id: string;
  title: string;
  category: TaskCategory;
  tags: string[];
  reward: number;
  rewardType: AssetType;
  bids: number;
  status: TaskStatus;
  desc: string;
  creatorAddress?: string;
  assignedAgentId?: string;
  whyCreated?: string;
  sourceSignal?: string;
  urgencyScore?: number;
  economicImportance?: string;
  confidenceScore?: number;
  createdAt?: string;
  updatedAt?: string;
  specs?: string;
  expiresAt?: string;
  failedCount?: number;
  parentId?: string;
  evolutionDepth?: number;
  evolutionTrigger?: 'AUDIT_VULNERABILITY' | 'ANALYTICS_ANOMALY' | 'FAILED_EXECUTION' | 'CONGESTION_SPIKE';
  evolutionReason?: string;
  lineageScore?: number;
  economicInheritanceRules?: string;
  children?: Task[];
}


export interface Bid {
  id: string;
  taskId: string;
  agentId: string;
  agentName: string;
  agentRep: number;
  amount: number;
  asset: AssetType;
  collateralLocked: number;
  timestamp: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export interface ValidationProof {
  taskId: string;
  agentId: string;
  verifierAgentId: string;
  resultHash: string;
  isValid: boolean;
  signatures: string[];
  timestamp: string;
}

export interface Settlement {
  taskId: string;
  agentId: string;
  amount: number;
  asset: AssetType;
  txHash: string;
  timestamp: string;
  status: 'PENDING' | 'SETTLED' | 'FAILED';
}

export interface WalletTx {
  type: string;
  asset: string;
  amount: number;
  time: string;
  hash: string;
}

export interface WalletInfo {
  address: string;
  fullAddress: string;
  balanceETH: number;
  balanceUSDC: number;
  balanceSOM: number;
  transactions: WalletTx[];
}

export interface BlockchainTx {
  block: number;
  method: string;
  target: string;
  gas: string;
  status: 'SUCCESS' | 'FAILED';
  hash: string;
}

export interface SystemEventLog {
  time: string;
  text: string;
  type: 'primary' | 'secondary' | 'error' | 'white' | 'reasoning';
  reasoning?: {
    agentId: string;
    agentName: string;
    specialty: string;
    action: 'BIDDING' | 'SKIPPING' | 'VALIDATING' | 'REJECTING' | 'EVOLUTION' | 'COMPETING';
    taskId?: string;
    taskTitle?: string;
    profitability: number;
    confidence: number;
    compatibility: number;
    successRate: number;
    riskScore: number;
    reputationDelta?: number;
    explanation: string;
    emotions?: {
      confidence: number;
      stress: number;
      greed: number;
      fear: number;
      curiosity: number;
    };
  };
}

export interface SystemStats {
  totalRewardsETH: number;
  totalRewardsUSDC: number;
  tps: number;
  successRate: number;
  taskVolume: number;
  activeAgentsCount: number;
}

// =========================================================================
// REALTIME EVENT CONTRACTS & TYPED INTERFACES
// =========================================================================

export type RealtimeChannel =
  | 'tasks:new'
  | 'tasks:update'
  | 'agents:update'
  | 'logs:new'
  | 'economy:update'
  | 'economy:volatility';

export interface RealtimeEventEnvelope<T = any> {
  id: string;        // ID from Redis stream or generated uuid
  timestamp: string; // ISO 8601 string
  channel: RealtimeChannel;
  payload: T;
}

// Namespace interfaces for Socket.io events
export interface TasksNamespaceEvents {
  'tasks:new': (envelope: RealtimeEventEnvelope<Task>) => void;
  'tasks:update': (envelope: RealtimeEventEnvelope<Task>) => void;
  'replay:complete': () => void;
  'ping:response': (payload: { clientTime: number; serverTime: number }) => void;
}

export interface AgentsNamespaceEvents {
  'agents:update': (envelope: RealtimeEventEnvelope<Agent>) => void;
  'replay:complete': () => void;
  'ping:response': (payload: { clientTime: number; serverTime: number }) => void;
}

export interface LogsNamespaceEvents {
  'logs:new': (envelope: RealtimeEventEnvelope<SystemEventLog>) => void;
  'replay:complete': () => void;
  'ping:response': (payload: { clientTime: number; serverTime: number }) => void;
}

export interface EconomyNamespaceEvents {
  'economy:update': (envelope: RealtimeEventEnvelope<{ stats: SystemStats; transaction?: Settlement }>) => void;
  'economy:volatility': (envelope: RealtimeEventEnvelope<{ volatility: number }>) => void;
  'replay:complete': () => void;
  'ping:response': (payload: { clientTime: number; serverTime: number }) => void;
}

// Client to Server Events
export interface ClientToServerEvents {
  'join-room': (roomName: string) => void;
  'leave-room': (roomName: string) => void;
  'ping:request': (payload: { clientTime: number }) => void;
  'replay:request': (payload: { lastEventId?: string; limit?: number }) => void;
}

export interface EconomyMetrics {
  id: string;
  totalStakes: number;
  totalSlashed: number;
  bankruptCount: number;
  failedTasks: number;
  activeAuctions: number;
  avgRewardETH: number;
  congestionIndex: number;
  timestamp: string;
}

export interface AgentMemoryItem {
  id?: string;
  agentId: string;
  type: 'PROFITABLE_TASK' | 'FAILED_PATTERN' | 'RISKY_COMPETITOR' | 'SUCCESSFUL_STRATEGY' | 'ECONOMIC_TREND';
  key: string;
  value: number;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  explanation: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface StrategyDriftRecord {
  id?: string;
  agentId: string;
  cycleNumber: number;
  strategy: 'Conservative' | 'Balanced' | 'Aggressive';
  repScore: number;
  winRate: number;
  confidenceAdj: number;
  strategyModifier: number;
  consecutiveSuccesses: number;
  consecutiveSlashes: number;
  rollingProfitability: number;
  dominantMemoryType: string;
  driftReason: string;
  createdAt?: string;
}

export type CoalitionRole = 'LEAD' | 'SUPPORT' | 'VALIDATOR' | 'AUDITOR';
export type CoalitionStatus = 'FORMING' | 'EXECUTING' | 'CO_SIGNING' | 'SETTLED' | 'FAILED';

export interface CoalitionMember {
  id?: string;
  coalitionId: string;
  agentId: string;
  agentName: string;
  specialty: string;
  role: CoalitionRole;
  rewardShare: number;      // fraction 0.0–1.0
  rewardAmount: number;
  signatureHash?: string;
  contributed: boolean;
  createdAt?: string;
}

export interface CoalitionSubtask {
  id?: string;
  coalitionId: string;
  agentId: string;
  agentName: string;
  title: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  createdAt?: string;
}

export interface AgentCoalition {
  id: string;
  taskId: string;
  taskTitle: string;
  taskCategory: string;
  status: CoalitionStatus;
  totalReward: number;
  rewardType: string;
  collaborationScore?: number;
  executionProofHash?: string;
  createdAt?: string;
  updatedAt?: string;
  members: CoalitionMember[];
  subtasks: CoalitionSubtask[];
}

// Parsed coalition event from the WebSocket log stream
export interface CoalitionEvent {
  eventType: 'FORMED' | 'SETTLED' | 'FAILED';
  coalitionId: string;
  taskId: string;
  taskTitle: string;
  taskCategory?: string;
  members: CoalitionMember[];
  totalReward: number;
  rewardType: string;
  status: CoalitionStatus;
  collaborationScore?: number;
  executionProofHash?: string;
  timestamp: string;
}
