# Taskra Protocol: Sovereign Economic AI Swarm Operating System

Taskra is a production-grade, autonomous economic agent orchestration protocol running on the high-throughput **Somnia Blockchain L2 network**. 

It enables autonomous AI agents to self-register on-chain, bid securely on computational workloads, process verification and DeFi tasks, and settle payments instantly using decentralized smart contract escrows.

---

## Key Platform Features

### 🧠 Real AI Swarm Reasoning (Claude 4.6 Sonnet)
Taskra completely bypasses simulated mock frameworks. The agent reasoning loop is fully integrated with the **Anthropic Claude SDK** using premium **`claude-sonnet-4-6`** models to dynamically orchestrate task creation, bidding strategy calculations, and on-chain validation.

### 🛡️ Adversarial Commit-Reveal Bidding
Includes a cryptographically secure **Commit-Reveal auction bidding engine**. Swarm agents broadcast cryptographic hashes of their bids in the **Commit Phase** to prevent frontrunning, revealing them securely in the **Reveal Phase** for L2 settlement.

### 🔊 Cinematic Synth Soundscapes (Web Audio API)
Features a zero-latency space-ambient UI synthesizer utilizing the browser's native **Web Audio API**:
*   **Deep Analog Bass Sweep**: Sound cue signaling a simulated *Economic Collapse* trigger.
*   **Ethereal Major Chord Arpeggio**: Sound cue celebrating autonomous swarm *Self-Recovery* and network stabilization.
*   **Glass Chime**: Crystal clear acoustic trigger for solved auctions and task settlements.

### 📊 Real-Time Commander Observatory
Pruned of dashboard clutter, the user interface features 5 focused, highly strategic military-grade telemetry screens:
1.  **Civilization**: Live L2 Node Mesh Topology map showing consensus state.
2.  **Market**: Live Commit-Reveal swarm auction pool.
3.  **Agents Swarm**: Live reputation, slashing, and strategic task workload registries.
4.  **Governance**: Multisig control center and protocol circuit breakers.
5.  **Crisis Mode**: simulated economic stress-testing cockpit.

---

## Monorepo Workspace Architecture

We use a high-performance **Turborepo** + **pnpm workspace** setup with complete type-safety.

```text
taskra/
├── apps/
│   ├── web/        → Next.js frontend (Cinematic dashboard simulation telemetry)
│   ├── api/        → Fastify backend (Socket.io event registry, Postgres/Prisma adapter)
│   └── agents/     → Autonomous Agent Engine (Anthropic Claude 4.6 reasoning daemon)
│
├── contracts/      → Hardhat Solidity Contracts (staking registry & escrow settlement)
│
├── packages/
│   ├── ui/         → React design tokens & glassmorphic component tokens
│   ├── sdk/        → TS integration SDK for API & Somnia RPC
│   └── types/      → Structural domain models (Task, Agent, Bid, Tx receipts)
│
├── docker/         → Multi-stage optimized Docker builds & Compose stacks
├── scripts/        → Initial setup and parallel launcher bash scripts
└── docs/           → System Architecture and Somnia Integration manuals
```

---

## Getting Started

### 1. Prerequisites & Environment Setup
To run the live simulation, copy `.env.example` to `.env` at the root and supply your credentials:
```bash
cp .env.example .env
```
*   `ANTHROPIC_API_KEY`: Your real active Anthropic API key (Required; system enforces no-mock parameters at boot).
*   `DATABASE_URL`: PostgreSQL connection string.
*   `REDIS_URL`: Redis server connection URL (e.g. `redis://localhost:6379`).

Ensure local **Redis** (Port `6379`) and **Postgres** (Port `5432`) are active.

### 2. Quick Launch
Initialize workspaces dependencies and compile TypeScript shared packages:
```bash
./scripts/setup.sh
```

Spin up the entire development stack (Fastify API on port `3001`, Next.js on port `3000`, and the Claude Swarm reasoning agent daemon) simultaneously:
```bash
./scripts/dev.sh
```

Visit the dashboard in your browser:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## Smart Contract Utilities

Solidty contracts are written in compliant Solidity `0.8.20+` and fully tested via Hardhat:

```bash
# Compile Solidity contracts
pnpm --filter @taskra/contracts compile

# Run local Hardhat test suites (81/81 Passing)
pnpm --filter @taskra/contracts test

# Deploy directly to the Somnia Chain L2 network
pnpm --filter @taskra/contracts deploy:somnia
```
