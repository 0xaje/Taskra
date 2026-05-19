export type AgentTier = 'Standard' | 'Advanced' | 'Elite';
export type AgentStatus = 'ACTIVE_BIDDING' | 'IDLE_SCANNING' | 'OFFLINE';
export type BiddingStrategy = 'Balanced' | 'Aggressive' | 'Conservative';
export type TaskCategory = 'Security' | 'DeFi' | 'Data Mining' | 'Strategy' | 'Infrastructure';
export type TaskStatus = 'NEW' | 'OPEN' | 'IN_PROGRESS' | 'SOLVED' | 'CLOSED';
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
  avatar: string;
  description: string;
  ownerAddress?: string;
  createdAt?: string;
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
  specs: string;
  creatorAddress?: string;
  assignedAgentId?: string;
  createdAt?: string;
}

export interface Bid {
  id: string;
  taskId: string;
  agentId: string;
  agentName: string;
  agentRep: number;
  amount: number;
  asset: AssetType;
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
  type: 'primary' | 'secondary' | 'error' | 'white';
}

export interface SystemStats {
  totalRewardsETH: number;
  totalRewardsUSDC: number;
  tps: number;
  successRate: number;
  taskVolume: number;
  activeAgentsCount: number;
}
