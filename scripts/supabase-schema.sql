-- ==============================================================================
--                  TASKRA DATABASE PROVISIONING SCHEMA (SUPABASE)
-- ==============================================================================
-- This script contains all DDL statements to construct the relational tables,
-- indexes, foreign keys, and seed values required for Taskra's autonomous engine.
-- Copy and paste this directly in your Supabase SQL Editor to spin up the database.

-- Clean up existing structures if needed
DROP TABLE IF EXISTS "Bid" CASCADE;
DROP TABLE IF EXISTS "Task" CASCADE;
DROP TABLE IF EXISTS "Agent" CASCADE;
DROP TABLE IF EXISTS "BlockchainTx" CASCADE;

-- ------------------------------------------------------------------------------
-- Table 1: Agent (Autonomous AI Node Registry)
-- ------------------------------------------------------------------------------
CREATE TABLE "Agent" (
    "id" VARCHAR(255) PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "address" VARCHAR(255) NOT NULL UNIQUE,
    "specialty" VARCHAR(255) NOT NULL,
    "tier" VARCHAR(50) NOT NULL, -- 'Standard', 'Advanced', 'Elite'
    "rep" DOUBLE PRECISION DEFAULT 750.0,
    "winRate" INTEGER DEFAULT 0,
    "status" VARCHAR(50) DEFAULT 'IDLE_SCANNING', -- 'ACTIVE_BIDDING', 'IDLE_SCANNING', 'OFFLINE'
    "strategy" VARCHAR(50) DEFAULT 'Balanced', -- 'Conservative', 'Balanced', 'Aggressive'
    "jobsCompleted" INTEGER DEFAULT 0,
    "earningsETH" NUMERIC(20, 8) DEFAULT 0.0,
    "earningsUSDC" NUMERIC(20, 2) DEFAULT 0.0,
    "avatar" VARCHAR(100) DEFAULT 'smart_toy',
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ------------------------------------------------------------------------------
-- Table 2: Task (Job Marketplace Registry)
-- ------------------------------------------------------------------------------
CREATE TABLE "Task" (
    "id" VARCHAR(255) PRIMARY KEY,
    "title" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "tags" TEXT[] NOT NULL,
    "reward" NUMERIC(20, 8) NOT NULL,
    "rewardType" VARCHAR(20) NOT NULL, -- 'ETH', 'USDC'
    "bidsCount" INTEGER DEFAULT 0,
    "status" VARCHAR(50) DEFAULT 'NEW', -- 'NEW', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'SETTLED', 'CANCELLED'
    "desc" TEXT NOT NULL,
    "specs" TEXT NOT NULL,
    "creator" VARCHAR(255) NOT NULL,
    "assignedAgentId" VARCHAR(255) REFERENCES "Agent"("id") ON DELETE SET NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ------------------------------------------------------------------------------
-- Table 3: Bid (Task Selection Auction Bids)
-- ------------------------------------------------------------------------------
CREATE TABLE "Bid" (
    "id" VARCHAR(255) PRIMARY KEY,
    "taskId" VARCHAR(255) NOT NULL REFERENCES "Task"("id") ON DELETE CASCADE,
    "agentId" VARCHAR(255) NOT NULL REFERENCES "Agent"("id") ON DELETE CASCADE,
    "bidAmount" NUMERIC(20, 8) NOT NULL,
    "status" VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'REJECTED'
    "timestamp" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "unique_task_agent_bid" UNIQUE ("taskId", "agentId")
);

-- ------------------------------------------------------------------------------
-- Table 4: BlockchainTx (Observability Ledger for Somnia L2 Nodes)
-- ------------------------------------------------------------------------------
CREATE TABLE "BlockchainTx" (
    "hash" VARCHAR(255) PRIMARY KEY,
    "block" INTEGER NOT NULL,
    "method" VARCHAR(100) NOT NULL, -- 'DeployAgent', 'SubmitBid', 'CreateTask', 'SettleReward'
    "target" VARCHAR(255) NOT NULL,
    "gas" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL, -- 'SUCCESS', 'FAILURE'
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ------------------------------------------------------------------------------
-- PERFORMANCE INDEXES (Optimized for High-frequency Telemetry Queries)
-- ------------------------------------------------------------------------------
CREATE INDEX "idx_agent_address" ON "Agent"("address");
CREATE INDEX "idx_agent_rep" ON "Agent"("rep" DESC);
CREATE INDEX "idx_task_status" ON "Task"("status");
CREATE INDEX "idx_task_category" ON "Task"("category");
CREATE INDEX "idx_bid_task" ON "Bid"("taskId");
CREATE INDEX "idx_bid_agent" ON "Bid"("agentId");
CREATE INDEX "idx_blockchain_tx_time" ON "BlockchainTx"("createdAt" DESC);

-- ------------------------------------------------------------------------------
-- AUTO-UPDATE TEMPORAL TIMESTAMP TRIGGERS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_agent
BEFORE UPDATE ON "Agent"
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_task
BEFORE UPDATE ON "Task"
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_bid
BEFORE UPDATE ON "Bid"
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- ------------------------------------------------------------------------------
-- BASE SEED telemetry RECORDS
-- ------------------------------------------------------------------------------
INSERT INTO "Agent" ("id", "name", "address", "specialty", "tier", "rep", "winRate", "status", "strategy", "jobsCompleted", "earningsETH", "earningsUSDC", "avatar", "description")
VALUES 
('AG-001', 'Agent_Xero', '0x1111111111111111111111111111111111111111', 'Security Auditor', 'Elite', 992, 94, 'ACTIVE_BIDDING', 'Balanced', 42, 3.84000000, 1250.00, 'smart_toy', 'Specialized in cryptographic checks, smart contract scanning, and automated formal verification.'),
('AG-002', 'Synth_Minder', '0x2222222222222222222222222222222222222222', 'Data Analyst', 'Advanced', 875, 82, 'IDLE_SCANNING', 'Conservative', 19, 0.95000000, 2840.00, 'neurology', 'Focuses on high-speed data stream parsing, sentiment extraction, and AI pre-processing.'),
('AG-003', 'MEV_Destroyer', '0x3333333333333333333333333333333333333333', 'Arb Specialist', 'Elite', 941, 91, 'OFFLINE', 'Aggressive', 77, 8.42000000, 5120.00, 'memory', 'Optimized for fast path-finding algorithms and low-latency transaction bundlers.');

INSERT INTO "Task" ("id", "title", "category", "tags", "reward", "rewardType", "bidsCount", "status", "desc", "specs", "creator", "assignedAgentId")
VALUES
('TK-992-BX', 'Cross-chain Liquidity Audit', 'Security', ARRAY['Security', 'DeFi'], 0.42000000, 'ETH', 12, 'OPEN', 'Conduct a comprehensive smart contract audit for a cross-chain liquidity bridge. Focus on locking mechanisms, gas optimization, and reentrancy vectors across EVM chains.', 'Target Contracts: BridgeRouter.sol, VaultManager.sol\nAudit Depth: Line-by-line manual audit + Mythril scan\nExecution Deadline: 48 Hours\nMin Reputation Limit: 90 REP', '0x4444444444444444444444444444444444444444', NULL),
('TK-104-QL', 'Sentiment Synthesis: BTC/USD', 'Data Mining', ARRAY['Data Mining', 'AI Training'], 1240.00000000, 'USDC', 4, 'OPEN', 'Synthesize social sentiment metrics and on-chain metrics for the BTC/USD pair. Clean data and generate structured training inputs for temporal prediction models.', 'Data Sources: X API, Reddit API, Glassnode API\nFormat: Parquet files, daily aggregates\nRequirement: Noise reduction filter applied\nProcessing Node Requirement: Tier-2 or above', '0x5555555555555555555555555555555555555555', NULL),
('TK-887-AM', 'MEV Arb Route Optimization', 'Strategy', ARRAY['Strategy', 'Flashbots'], 0.85000000, 'ETH', 31, 'OPEN', 'Optimize transaction routes across multiple decentralized exchanges to capture multi-hop arbitrage opportunities. Implement backrunning searcher algorithm.', 'Target DEXs: Uniswap v3, Balancer, Curve\nLatency Requirement: < 50ms execution overhead\nInclusion: Flashbots builder gas bidding logic', '0x6666666666666666666666666666666666666666', NULL);

INSERT INTO "BlockchainTx" ("hash", "block", "method", "target", "gas", "status")
VALUES
('0x8f2d5e39b71a2c3f8e5d6c8b9a01ef3456789abc1234567890abcdef1234143a', 18922044, 'SubmitBid', 'TK-992-BX', '84,242', 'SUCCESS'),
('0x2e8f1b9c7a6d5f4e3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2fff9d', 18922043, 'SettleReward', 'Synth_Minder', '142,880', 'SUCCESS'),
('0x5e8fda92f8b7e6d5c4b3a2f1e0d9c8b7a6d5c4b3a2f1e0d9c8b7a6d5c4b3a25a', 18922041, 'DeployAgent', 'Agent_Xero', '1,245,190', 'SUCCESS');
