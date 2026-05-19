import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { Button, Card } from '@taskra/ui';
import { Agent, Task, Bid, BlockchainTx, SystemStats, SystemEventLog, WalletInfo } from '@taskra/types';

export default function Home() {
  // --- Core State ---
  const [currentView, setView] = useState<'dashboard' | 'market' | 'agents' | 'onchain'>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [simulationActive, setSimulationActive] = useState<boolean>(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  
  const [stats, setStats] = useState<SystemStats>({
    totalRewardsETH: 1842.12,
    totalRewardsUSDC: 8500,
    tps: 14.8,
    successRate: 98.42,
    taskVolume: 2.1,
    activeAgentsCount: 3
  });

  const [wallet, setWallet] = useState<WalletInfo>({
    address: '0x71C...3E4',
    fullAddress: '0x71C24151a6E39b1B33e7dAdF4E18dF8E1Cb3e44b',
    balanceETH: 12.42,
    balanceUSDC: 8500,
    balanceSOM: 120,
    transactions: [
      { type: 'Escrow Lock', asset: 'ETH', amount: 0.15, time: '22:45:10', hash: '0x3a4f1d...9c2d' },
      { type: 'Reward Claims', asset: 'USDC', amount: 350.00, time: '21:12:33', hash: '0x7b1e4c...f8a2' },
      { type: 'Escrow Lock', asset: 'ETH', amount: 0.50, time: '19:05:12', hash: '0x4f12eb...ad56' }
    ]
  });

  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 'TK-992-BX',
      title: 'Cross-chain Liquidity Audit',
      category: 'Security',
      tags: ['Security', 'DeFi'],
      reward: 0.42,
      rewardType: 'ETH',
      bids: 12,
      status: 'OPEN',
      desc: 'Conduct a comprehensive smart contract audit for a cross-chain liquidity bridge. Focus on locking mechanisms, gas optimization, and reentrancy vectors across EVM chains.',
      specs: 'Target Contracts: BridgeRouter.sol, VaultManager.sol\nAudit Depth: Line-by-line manual audit + Mythril scan\nExecution Deadline: 48 Hours\nMin Reputation Limit: 90 REP'
    },
    {
      id: 'TK-104-QL',
      title: 'Sentiment Synthesis: BTC/USD',
      category: 'Data Mining',
      tags: ['Data Mining', 'AI Training'],
      reward: 1240,
      rewardType: 'USDC',
      bids: 4,
      status: 'OPEN',
      desc: 'Synthesize social sentiment metrics and on-chain metrics for the BTC/USD pair. Clean data and generate structured training inputs for temporal prediction models.',
      specs: 'Data Sources: X API, Reddit API, Glassnode API\nFormat: Parquet files, daily aggregates\nRequirement: Noise reduction filter applied\nProcessing Node Requirement: Tier-2 or above'
    },
    {
      id: 'TK-887-AM',
      title: 'MEV Arb Route Optimization',
      category: 'Strategy',
      tags: ['Strategy', 'Flashbots'],
      reward: 0.85,
      rewardType: 'ETH',
      bids: 31,
      status: 'OPEN',
      desc: 'Optimize transaction routes across multiple decentralized exchanges to capture multi-hop arbitrage opportunities. Implement backrunning searcher algorithm.',
      specs: 'Target DEXs: Uniswap v3, Balancer, Curve\nLatency Requirement: < 50ms execution overhead\nInclusion: Flashbots builder gas bidding logic'
    },
    {
      id: 'TK-221-ZY',
      title: 'Node Latency Benchmark',
      category: 'Infrastructure',
      tags: ['Infrastructure'],
      reward: 150,
      rewardType: 'USDC',
      bids: 0,
      status: 'NEW',
      desc: 'Run full network latency benchmarks across 45 active validator nodes. Capture ping, block propagation time, and gossip protocol throughput.',
      specs: 'Nodes: Global distributed validator set\nDuration: 24-hour continuous tracking\nDeliverable: Raw JSON dump + analysis report'
    }
  ]);

  const [agents, setAgents] = useState<Agent[]>([
    {
      id: 'AG-001',
      name: 'Agent_Xero',
      specialty: 'Security Auditor',
      tier: 'Elite',
      rep: 99.2,
      winRate: 94,
      status: 'ACTIVE_BIDDING',
      strategy: 'Balanced',
      jobsCompleted: 42,
      earningsETH: 3.84,
      earningsUSDC: 1250,
      avatar: 'smart_toy',
      description: 'Specialized in cryptographic checks, smart contract scanning, and automated formal verification.'
    },
    {
      id: 'AG-002',
      name: 'Synth_Minder',
      specialty: 'Data Analyst',
      tier: 'Advanced',
      rep: 87.5,
      winRate: 82,
      status: 'IDLE_SCANNING',
      strategy: 'Conservative',
      jobsCompleted: 19,
      earningsETH: 0.95,
      earningsUSDC: 2840,
      avatar: 'neurology',
      description: 'Focuses on high-speed data stream parsing, sentiment extraction, and AI pre-processing.'
    },
    {
      id: 'AG-003',
      name: 'MEV_Destroyer',
      specialty: 'Arb Specialist',
      tier: 'Elite',
      rep: 94.1,
      winRate: 91,
      status: 'OFFLINE',
      strategy: 'Aggressive',
      jobsCompleted: 77,
      earningsETH: 8.42,
      earningsUSDC: 5120,
      avatar: 'memory',
      description: 'Optimized for fast path-finding algorithms and low-latency transaction bundlers.'
    }
  ]);

  const [events, setEvents] = useState<SystemEventLog[]>([
    { time: '22:49:01', text: 'BID_PLACED: Agent_Xero -> TK-992-BX (0.38 ETH)', type: 'secondary' },
    { time: '22:48:15', text: 'ASSIGNMENT: Synth_Minder <- TK-104-QL (COMPLETED)', type: 'white' },
    { time: '22:47:40', text: 'LOG: Network expansion protocol initiated v2.4', type: 'primary' },
    { time: '22:46:12', text: 'BID_REJECTED: Bot_404 -> TK-992-BX (Insuff. Rep)', type: 'error' },
    { time: '22:45:00', text: 'SYNC: Block 18,922,044 broadcasted', type: 'secondary' },
    { time: '22:43:55', text: 'TASK_POSTED: New node latency test (150 USDC)', type: 'white' }
  ]);

  const [onchainLogs, setOnchainLogs] = useState<BlockchainTx[]>([
    { block: 18922044, method: 'SubmitBid', target: 'TK-992-BX', gas: '84,242', status: 'SUCCESS', hash: '0x8f2d5e...143a' },
    { block: 18922043, method: 'SettleReward', target: 'Synth_Minder', gas: '142,880', status: 'SUCCESS', hash: '0x2e8f1b...ff9d' },
    { block: 18922041, method: 'DeployAgent', target: 'Agent_Xero', gas: '1,245,190', status: 'SUCCESS', hash: '0xc8da92...51ba' },
    { block: 18922040, method: 'CreateTask', target: 'TK-221-ZY', gas: '380,450', status: 'SUCCESS', hash: '0x7e8412...ee8a' },
    { block: 18922038, method: 'UpdateStrategy', target: 'MEV_Destroyer', gas: '45,210', status: 'SUCCESS', hash: '0x991f8a...cd32' }
  ]);

  // --- Filtering & Sorting State ---
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [sortFilter, setSortFilter] = useState<string>('REWARD_DESC');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // --- Modal Open State ---
  const [deployModalOpen, setDeployModalOpen] = useState<boolean>(false);
  const [walletModalOpen, setWalletModalOpen] = useState<boolean>(false);
  const [specsModalOpen, setSpecsModalOpen] = useState<boolean>(false);
  const [configModalOpen, setConfigModalOpen] = useState<boolean>(false);

  // --- Interactive Specs / Config state ---
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedTxIndex, setSelectedTxIndex] = useState<number | null>(null);
  const [manualAllocAgentId, setManualAllocAgentId] = useState<string>('');

  // --- Wallet Faucet Cool Down ---
  const [lastFaucetTime, setLastFaucetTime] = useState<number>(0);

  // --- Form values ---
  const [postTitle, setPostTitle] = useState<string>('');
  const [postCategory, setPostCategory] = useState<string>('Security');
  const [postReward, setPostReward] = useState<number>(0.5);
  const [postAsset, setPostAsset] = useState<'ETH' | 'USDC'>('ETH');
  const [postDesc, setPostDesc] = useState<string>('');

  const [deployName, setDeployName] = useState<string>('');
  const [deploySpecialty, setDeploySpecialty] = useState<string>('Security Auditor');
  const [deployTier, setDeployTier] = useState<'Standard' | 'Advanced' | 'Elite'>('Standard');

  const [configStatus, setConfigStatus] = useState<Agent['status']>('ACTIVE_BIDDING');
  const [configStrategy, setConfigStrategy] = useState<Agent['strategy']>('Balanced');

  // Blockheight simulator
  const [blockHeight, setBlockHeight] = useState<number>(18922044);
  const [charts, setCharts] = useState({
    rewards: [1810.12, 1822.45, 1825.80, 1833.12, 1840.40, 1842.12],
    tps: [12.4, 15.2, 14.8, 16.1, 13.9, 14.8],
    volume: [1.8, 1.9, 2.1, 2.0, 2.15, 2.1]
  });

  const terminalRef = useRef<HTMLDivElement>(null);

  // --- Toggle Theme Hook ---
  const toggleTheme = () => {
    const html = document.documentElement;
    if (html.classList.contains('light')) {
      html.classList.remove('light');
      html.classList.add('dark');
      setTheme('dark');
    } else {
      html.classList.remove('dark');
      html.classList.add('light');
      setTheme('light');
    }
  };

  // --- Add Event Log Helper ---
  const addEvent = (text: string, type: SystemEventLog['type'] = 'white') => {
    const time = new Date().toLocaleTimeString();
    setEvents(prev => [...prev, { time, text, type }]);
  };

  // --- Auto-scroll Terminal ---
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [events]);

  // --- Background Live Simulation Loop ---
  useEffect(() => {
    if (!simulationActive) return;

    const interval = setInterval(() => {
      // 1. Slightly oscillate TPS throughput
      const tpsFluctuation = (Math.random() - 0.5) * 1.8;
      setStats(prev => {
        const nextTps = Math.max(8.0, Math.min(30.0, prev.tps + tpsFluctuation));
        setCharts(c => ({
          ...c,
          tps: [...c.tps.slice(1), nextTps]
        }));
        return { ...prev, tps: nextTps };
      });

      // 2. Chance of an external computational task posted
      if (Math.random() < 0.18) {
        const titles = [
          'AMM Swap Path Optimizer',
          'Zero-Knowledge Proof Verifier',
          'Chainlink Feed Latency Checker',
          'ERC-20 Vulnerability Fuzzer',
          'Epoch Block Propagation Audit'
        ];
        const categories = ['Strategy', 'Security', 'Infrastructure', 'Security', 'Infrastructure'];
        const index = Math.floor(Math.random() * titles.length);
        const rewardType = Math.random() > 0.5 ? 'ETH' : 'USDC';
        const reward = rewardType === 'ETH' ? parseFloat((0.1 + Math.random() * 0.8).toFixed(2)) : Math.floor(200 + Math.random() * 1500);

        const taskId = `TK-${Math.floor(100 + Math.random() * 899)}-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
        
        const newTask: Task = {
          id: taskId,
          title: titles[index],
          category: categories[index] as Task['category'],
          tags: [categories[index], rewardType],
          reward,
          rewardType: rewardType as Task['rewardType'],
          bids: Math.floor(Math.random() * 6),
          status: 'NEW',
          desc: `Automatically dispatched target contract computing specification. Run sanity verification constraints and assert execution validity.`,
          specs: `Gas escrows: LOCKED\nMin Reputation: 80 REP\nTimeout: 12,000 blocks`
        };

        setTasks(prev => [...prev, newTask]);
        addEvent(`TASK_POSTED: External builder broadcasted "${titles[index]}" reward: ${reward} ${rewardType}`, 'white');
      }

      // 3. Simulated bid placement on existing tasks
      if (Math.random() < 0.25 && tasks.length > 0) {
        setTasks(prev => {
          if (prev.length === 0) return prev;
          const randomIndex = Math.floor(Math.random() * prev.length);
          const copy = [...prev];
          const task = copy[randomIndex];
          if (task) {
            task.bids += 1;
            const externalAgents = ['Neura_Link', 'Cyber_Shield', 'Hash_Lock', 'Byte_Vanguard', 'Sol_Pulse'];
            const randomBot = externalAgents[Math.floor(Math.random() * externalAgents.length)];
            addEvent(`BID_PLACED: ${randomBot} submitted contract bid on ${task.id} (${(task.reward * 0.92).toFixed(2)} ${task.rewardType})`, 'secondary');
          }
          return copy;
        });
      }

      // 4. Block mined tick
      if (Math.random() < 0.1) {
        setBlockHeight(b => {
          const nextBlock = b + 1;
          addEvent(`SYNC: Block #${nextBlock.toLocaleString()} successfully minted on L2 consensus`, 'primary');
          
          // Add to onchain logs
          const methods = ['SubmitBid', 'CreateTask', 'SettleReward', 'DeployAgent'];
          const randomMethod = methods[Math.floor(Math.random() * methods.length)];
          const newTx: BlockchainTx = {
            block: nextBlock,
            method: randomMethod,
            target: '0x' + Math.random().toString(16).slice(2, 6) + '...',
            gas: Math.floor(40000 + Math.random() * 800000).toLocaleString(),
            status: 'SUCCESS',
            hash: '0x' + Math.random().toString(16).slice(2, 8)
          };
          setOnchainLogs(logs => [newTx, ...logs.slice(0, 29)]);
          return nextBlock;
        });
      }

      // 5. Chance of user bidding agent completing active jobs autonomously
      if (Math.random() < 0.15) {
        const biddingAgents = agents.filter(a => a.status === 'ACTIVE_BIDDING');
        if (biddingAgents.length > 0 && tasks.length > 0) {
          const agent = biddingAgents[Math.floor(Math.random() * biddingAgents.length)];
          const openTaskIndex = tasks.findIndex(t => t.status === 'OPEN' || t.status === 'NEW');
          if (openTaskIndex !== -1) {
            const task = tasks[openTaskIndex];
            if (task) completeTask(task, agent);
          }
        }
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [simulationActive, tasks, agents]);

  // --- Complete task logic ---
  const completeTask = (task: Task, agent: Agent) => {
    // Reward agent & user
    setAgents(prev => prev.map(a => {
      if (a.id === agent.id) {
        return {
          ...a,
          earningsETH: task.rewardType === 'ETH' ? a.earningsETH + task.reward : a.earningsETH,
          earningsUSDC: task.rewardType === 'USDC' ? a.earningsUSDC + task.reward : a.earningsUSDC,
          jobsCompleted: a.jobsCompleted + 1,
          rep: Math.min(100.0, a.rep + 0.5)
        };
      }
      return a;
    }));

    setWallet(prev => ({
      ...prev,
      balanceETH: task.rewardType === 'ETH' ? prev.balanceETH + task.reward : prev.balanceETH,
      balanceUSDC: task.rewardType === 'USDC' ? prev.balanceUSDC + task.reward : prev.balanceUSDC,
      transactions: [{
        type: `Reward: ${task.title}`,
        asset: task.rewardType,
        amount: task.reward,
        time: new Date().toLocaleTimeString(),
        hash: '0x' + Math.random().toString(16).slice(2, 8)
      }, ...prev.transactions]
    }));

    setStats(prev => {
      const nextETH = task.rewardType === 'ETH' ? prev.totalRewardsETH + task.reward : prev.totalRewardsETH;
      setCharts(c => ({
        ...c,
        rewards: [...c.rewards.slice(1), nextETH]
      }));
      return {
        ...prev,
        totalRewardsETH: nextETH,
        totalRewardsUSDC: task.rewardType === 'USDC' ? prev.totalRewardsUSDC + task.reward : prev.totalRewardsUSDC
      };
    });

    // Remove task from list
    setTasks(prev => prev.filter(t => t.id !== task.id));
    addEvent(`JOB_SUCCESS: Agent ${agent.name} solved job "${task.title}" (+${task.reward} ${task.rewardType})`, 'secondary');

    // Add block explorer log
    setBlockHeight(b => {
      const nextBlock = b + 1;
      setOnchainLogs(logs => [{
        block: nextBlock,
        method: 'SettleReward',
        target: agent.name,
        gas: '220,105',
        status: 'SUCCESS',
        hash: '0x' + Math.random().toString(16).slice(2, 8)
      }, ...logs]);
      return nextBlock;
    });
  };

  // --- Handlers ---
  const handlePostTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle || !postDesc) return;

    if (postAsset === 'ETH') {
      if (wallet.balanceETH < postReward) {
        alert("Insufficient ETH balance to lock into Escrow!");
        return;
      }
      setWallet(w => ({ ...w, balanceETH: w.balanceETH - postReward }));
    } else {
      if (wallet.balanceUSDC < postReward) {
        alert("Insufficient USDC balance to lock into Escrow!");
        return;
      }
      setWallet(w => ({ ...w, balanceUSDC: w.balanceUSDC - postReward }));
    }

    const taskId = `TK-${Math.floor(100 + Math.random() * 899)}-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
    
    const newTask: Task = {
      id: taskId,
      title: postTitle,
      category: postCategory as Task['category'],
      tags: [postCategory, postAsset],
      reward: postReward,
      rewardType: postAsset,
      bids: 0,
      status: 'NEW',
      desc: postDesc,
      specs: `Instruction hash: md5-${Math.random().toString(16).slice(2, 10)}\nGas Escrow Vault: LOCKED\nNetwork Compatibility: Global Distributed`
    };

    setTasks(prev => [...prev, newTask]);
    addEvent(`TASK_POSTED: Locked ${postReward} ${postAsset} escrow. Posted "${postTitle}" (${taskId})`, 'white');

    setWallet(w => ({
      ...w,
      transactions: [{
        type: `Escrow Lock: ${postTitle}`,
        asset: postAsset,
        amount: postReward,
        time: new Date().toLocaleTimeString(),
        hash: '0x' + Math.random().toString(16).slice(2, 8)
      }, ...w.transactions]
    }));

    setBlockHeight(b => {
      const nextBlock = b + 1;
      setOnchainLogs(logs => [{
        block: nextBlock,
        method: 'CreateTask',
        target: taskId,
        gas: '342,000',
        status: 'SUCCESS',
        hash: '0x' + Math.random().toString(16).slice(2, 8)
      }, ...logs]);
      return nextBlock;
    });

    // Reset Fields
    setPostTitle('');
    setPostDesc('');
    setPostReward(0.5);
  };

  const handleDeployAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deployName) return;

    let cost = 0.05;
    let rep = 75.0;
    let winRate = 78;
    let avatar = 'smart_toy';

    if (deployTier === 'Advanced') {
      cost = 0.15;
      rep = 88.0;
      winRate = 86;
      avatar = 'neurology';
    } else if (deployTier === 'Elite') {
      cost = 0.50;
      rep = 96.0;
      winRate = 95;
      avatar = 'memory';
    }

    if (wallet.balanceETH < cost) {
      alert("Insufficient ETH balance in connected wallet!");
      return;
    }

    setWallet(w => ({
      ...w,
      balanceETH: w.balanceETH - cost,
      transactions: [{
        type: 'Agent Deploy',
        asset: 'ETH',
        amount: cost,
        time: new Date().toLocaleTimeString(),
        hash: '0x' + Math.random().toString(16).slice(2, 8)
      }, ...w.transactions]
    }));

    const newAgent: Agent = {
      id: `AG-00${agents.length + 1}`,
      name: deployName,
      specialty: deploySpecialty,
      tier: deployTier,
      rep,
      winRate,
      status: 'ACTIVE_BIDDING',
      strategy: 'Balanced',
      jobsCompleted: 0,
      earningsETH: 0,
      earningsUSDC: 0,
      avatar,
      description: `Self-learning autonomous node deployed under ${deployTier} configurations, focusing on ${deploySpecialty} workloads.`
    };

    setAgents(prev => [...prev, newAgent]);
    addEvent(`DEPLOY: Deployed agent ${deployName} under specialty "${deploySpecialty}" (${cost} ETH stake locked)`, 'secondary');

    setBlockHeight(b => {
      const nextBlock = b + 1;
      setOnchainLogs(logs => [{
        block: nextBlock,
        method: 'DeployAgent',
        target: deployName,
        gas: '1,450,220',
        status: 'SUCCESS',
        hash: '0x' + Math.random().toString(16).slice(2, 8)
      }, ...logs]);
      return nextBlock;
    });

    setDeployModalOpen(false);
    setDeployName('');
  };

  const handleManualAllocation = () => {
    if (!manualAllocAgentId || !selectedTaskId) {
      alert("Please select an active agent node first.");
      return;
    }

    const agent = agents.find(a => a.id === manualAllocAgentId);
    const task = tasks.find(t => t.id === selectedTaskId);
    if (!agent || !task) return;

    // Submit execution bid
    setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: 'ACTIVE_BIDDING' } : a));
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, bids: t.bids + 1 } : t));

    addEvent(`ALLOCATION: Allocated agent "${agent.name}" to execute specs job "${task.title}"`, 'white');

    setBlockHeight(b => {
      const nextBlock = b + 1;
      setOnchainLogs(logs => [{
        block: nextBlock,
        method: 'SubmitBid',
        target: task.id,
        gas: '75,120',
        status: 'SUCCESS',
        hash: '0x' + Math.random().toString(16).slice(2, 8)
      }, ...logs]);
      return nextBlock;
    });

    // Simulate instant success
    setTimeout(() => {
      completeTask(task, agent);
    }, 1500);

    setSpecsModalOpen(false);
  };

  const triggerFaucet = () => {
    const now = Date.now();
    if (now - lastFaucetTime < 30000) {
      alert("Faucet cooling down. Please wait 30 seconds before calling faucet again.");
      return;
    }
    setLastFaucetTime(now);
    setWallet(w => ({
      ...w,
      balanceETH: w.balanceETH + 5.0,
      balanceUSDC: w.balanceUSDC + 1000,
      transactions: [{
        type: 'Sandbox Faucet Claim',
        asset: 'ETH & USDC',
        amount: 5,
        time: new Date().toLocaleTimeString(),
        hash: '0xfc' + Math.random().toString(16).slice(2, 6)
      }, ...w.transactions]
    }));

    addEvent(`FAUCET: Faucet credited wallet (+5.0 ETH, +1,000 USDC)`, 'primary');
  };

  const upgradeAgentTier = () => {
    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent) return;

    let cost = 0;
    let nextTier: Agent['tier'] = 'Standard';
    if (agent.tier === 'Standard') {
      cost = 0.10;
      nextTier = 'Advanced';
    } else if (agent.tier === 'Advanced') {
      cost = 0.35;
      nextTier = 'Elite';
    }

    if (wallet.balanceETH < cost) {
      alert("Insufficient ETH balance for upgrade fees!");
      return;
    }

    setWallet(w => ({ ...w, balanceETH: w.balanceETH - cost }));
    setAgents(prev => prev.map(a => {
      if (a.id === agent.id) {
        return {
          ...a,
          tier: nextTier,
          rep: Math.min(100.0, a.rep + 6.0),
          winRate: Math.min(99, a.winRate + 5),
          avatar: nextTier === 'Advanced' ? 'neurology' : 'memory'
        };
      }
      return a;
    }));

    addEvent(`UPGRADE: Upgraded agent "${agent.name}" compute logic to ${nextTier} Tier (-${cost} ETH)`, 'secondary');
    setConfigModalOpen(false);
  };

  const decommissionAgent = () => {
    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent) return;

    let refund = 0.025;
    if (agent.tier === 'Advanced') refund = 0.075;
    if (agent.tier === 'Elite') refund = 0.25;

    setWallet(w => ({
      ...w,
      balanceETH: w.balanceETH + refund,
      transactions: [{
        type: `Decommission: ${agent.name}`,
        asset: 'ETH',
        amount: refund,
        time: new Date().toLocaleTimeString(),
        hash: '0x' + Math.random().toString(16).slice(2, 8)
      }, ...w.transactions]
    }));

    setAgents(prev => prev.filter(a => a.id !== agent.id));
    addEvent(`DECOMMISSION: Purged agent "${agent.name}" runtime. Refunded ${refund} ETH`, 'error');
    setConfigModalOpen(false);
  };

  const saveAgentConfig = () => {
    setAgents(prev => prev.map(a => {
      if (a.id === selectedAgentId) {
        return { ...a, status: configStatus, strategy: configStrategy };
      }
      return a;
    }));
    setConfigModalOpen(false);
  };

  // Generate randomized agent name helper
  const triggerGenerateName = () => {
    const prefixes = ['Aether', 'Neural', 'Cyber', 'Byte', 'Sentinel', 'Crypto', 'Quant', 'Giga', 'Sol', 'Hyper'];
    const suffixes = ['Vanguard', 'Xero', 'Mind', 'Watcher', 'Arb', 'Shield', 'Synth', 'Node', 'Pulse', 'Core'];
    const randomName = prefixes[Math.floor(Math.random() * prefixes.length)] + "_" + suffixes[Math.floor(Math.random() * suffixes.length)];
    setDeployName(randomName);
  };

  // Sparkline drawer helper
  const drawSparklineD = (points: number[]) => {
    const width = 100;
    const height = 40;
    const max = Math.max(...points, 1);
    const min = Math.min(...points, 0);
    const range = max - min || 1;

    let pathD = `M 0 ${height - ((points[0] - min) / range) * (height - 10) - 5}`;
    for (let i = 1; i < points.length; i++) {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((points[i] - min) / range) * (height - 10) - 5;
      pathD += ` L ${x} ${y}`;
    }
    return pathD;
  };

  // Filter Tasks
  let filteredTasks = [...tasks];
  if (categoryFilter !== 'ALL') {
    filteredTasks = filteredTasks.filter(t => t.category === categoryFilter);
  }
  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase();
    filteredTasks = filteredTasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.desc.toLowerCase().includes(q)
    );
  }
  if (sortFilter === 'REWARD_DESC') {
    filteredTasks.sort((a, b) => {
      const valA = a.rewardType === 'ETH' ? a.reward * 3000 : a.reward;
      const valB = b.rewardType === 'ETH' ? b.reward * 3000 : b.reward;
      return valB - valA;
    });
  } else if (sortFilter === 'REWARD_ASC') {
    filteredTasks.sort((a, b) => {
      const valA = a.rewardType === 'ETH' ? a.reward * 3000 : a.reward;
      const valB = b.rewardType === 'ETH' ? b.reward * 3000 : b.reward;
      return valA - valB;
    });
  } else if (sortFilter === 'BIDS_DESC') {
    filteredTasks.sort((a, b) => b.bids - a.bids);
  } else if (sortFilter === 'NEWEST') {
    filteredTasks.sort((a, b) => b.status === 'NEW' ? 1 : -1);
  }

  // Selected specs task
  const activeSpecsTask = tasks.find(t => t.id === selectedTaskId);
  // Selected configuring agent
  const activeConfigAgent = agents.find(a => a.id === selectedAgentId);

  return (
    <>
      <Head>
        <title>TASKRA - Live Autonomous Agent Marketplace</title>
      </Head>

      <div className="flex h-screen overflow-hidden">
        {/* Backdrop for mobile drawer */}
        {mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
          />
        )}

        {/* Sidebar Navigation */}
        <aside
          className={`w-[280px] flex-shrink-0 flex flex-col border-r border-outline-variant dark:border-zinc-800 h-full bg-surface-container-low dark:bg-zinc-900 transition-all duration-300 z-50 max-lg:fixed max-lg:top-0 max-lg:bottom-0 max-lg:left-0 ${
            mobileSidebarOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'
          }`}
        >
          <header className="h-12 flex items-center px-lg border-b border-outline-variant dark:border-zinc-800 justify-between">
            <span className="font-headline text-lg font-bold tracking-tighter text-primary dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-secondary dark:text-cyan-400 font-bold">radar</span>
              TASKRA
            </span>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="lg:hidden text-outline dark:text-zinc-400 hover:text-primary dark:hover:text-white material-symbols-outlined"
              title="Close Menu"
            >
              close
            </button>
          </header>

          <nav className="flex-1 px-sm py-md space-y-xs">
            <button
              onClick={() => { setView('dashboard'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-md px-md py-sm rounded transition-all duration-200 group font-bold shadow-sm ${
                currentView === 'dashboard'
                  ? 'bg-secondary/15 dark:bg-secondary/20 text-secondary dark:text-secondary-fixed-dim'
                  : 'text-on-surface-variant dark:text-zinc-400 hover:bg-surface-variant dark:hover:bg-zinc-800 hover:text-primary dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined">dashboard</span>
              <span className="font-label text-sm font-medium">Dashboard</span>
            </button>
            <button
              onClick={() => { setView('market'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-md px-md py-sm rounded transition-all duration-200 group font-bold shadow-sm ${
                currentView === 'market'
                  ? 'bg-secondary/15 dark:bg-secondary/20 text-secondary dark:text-secondary-fixed-dim'
                  : 'text-on-surface-variant dark:text-zinc-400 hover:bg-surface-variant dark:hover:bg-zinc-800 hover:text-primary dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined">analytics</span>
              <span className="font-label text-sm font-medium">Live Task Market</span>
            </button>
            <button
              onClick={() => { setView('agents'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-md px-md py-sm rounded transition-all duration-200 group font-bold shadow-sm ${
                currentView === 'agents'
                  ? 'bg-secondary/15 dark:bg-secondary/20 text-secondary dark:text-secondary-fixed-dim'
                  : 'text-on-surface-variant dark:text-zinc-400 hover:bg-surface-variant dark:hover:bg-zinc-800 hover:text-primary dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined">hub</span>
              <span className="font-label text-sm font-medium">Agent Network</span>
            </button>
            <button
              onClick={() => { setView('onchain'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-md px-md py-sm rounded transition-all duration-200 group font-bold shadow-sm ${
                currentView === 'onchain'
                  ? 'bg-secondary/15 dark:bg-secondary/20 text-secondary dark:text-secondary-fixed-dim'
                  : 'text-on-surface-variant dark:text-zinc-400 hover:bg-surface-variant dark:hover:bg-zinc-800 hover:text-primary dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined">receipt_long</span>
              <span className="font-label text-sm font-medium">On-chain activity Log</span>
            </button>
          </nav>

          <div className="p-lg space-y-lg border-t border-outline-variant dark:border-zinc-800">
            {/* Wallet Address Trigger */}
            <div className="space-y-sm">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-outline dark:text-zinc-500">
                <span>Wallet</span>
                <span className="text-secondary dark:text-cyan-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary dark:bg-cyan-400"></span> Connected
                </span>
              </div>
              <button
                onClick={() => setWalletModalOpen(true)}
                className="w-full text-left p-md bg-surface-container-lowest dark:bg-zinc-950 hover:bg-surface-container-high dark:hover:bg-zinc-800 border border-outline-variant dark:border-zinc-800 rounded-lg flex items-center gap-md transition-all group"
              >
                <div className="w-8 h-8 rounded-full bg-surface-container dark:bg-zinc-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-primary dark:text-zinc-300 text-[18px]">account_balance_wallet</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-data-mono text-[11px] text-on-surface dark:text-zinc-200 font-bold truncate">{wallet.address}</p>
                  <p className="font-data-mono text-[9px] text-outline dark:text-zinc-400">{wallet.balanceETH.toFixed(2)} ETH</p>
                </div>
              </button>
            </div>

            {/* System Health */}
            <div className="space-y-sm">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-outline dark:text-zinc-500">
                <span>System Health</span>
                <span className="text-[9px] bg-secondary dark:bg-cyan-500/20 text-on-secondary dark:text-cyan-400 px-1.5 py-0.5 rounded-sm font-bold">STABLE</span>
              </div>
              <div className="space-y-xs">
                <div className="flex justify-between text-[11px] font-data-mono">
                  <span class="text-on-surface-variant dark:text-zinc-400">Uptime</span>
                  <span className="text-on-surface dark:text-zinc-200 font-medium">99.98%</span>
                </div>
                <div className="flex justify-between text-[11px] font-data-mono">
                  <span class="text-on-surface-variant dark:text-zinc-400">Active Agents</span>
                  <span className="text-on-surface dark:text-zinc-200 font-medium">{agents.length}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-surface dark:bg-zinc-950 transition-colors">
          {/* Top Header App Bar */}
          <header className="h-12 flex items-center justify-between px-lg border-b border-outline-variant dark:border-zinc-800 glass-panel sticky top-0 z-10">
            <div className="flex items-center gap-md">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden text-primary dark:text-zinc-200 material-symbols-outlined hover:bg-surface-container dark:hover:bg-zinc-800 p-1.5 rounded transition-all mr-1"
                title="Open Menu"
              >
                menu
              </button>
              <span className={`material-symbols-outlined text-primary dark:text-zinc-200 ${simulationActive ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }}>sync</span>
              <span className="font-headline text-sm font-bold tracking-tight text-primary dark:text-white max-sm:hidden">
                {currentView === 'dashboard' && 'Live Marketplace Feed'}
                {currentView === 'market' && 'Dynamic Escrow Task Pool'}
                {currentView === 'agents' && 'Agent Diagnostics Center'}
                {currentView === 'onchain' && 'Block Explorer Ledger'}
              </span>
            </div>

            <div className="flex items-center gap-md sm:gap-xl">
              {/* Simulation Switch */}
              <div className="flex items-center gap-xs bg-surface-container-low dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 rounded-full px-sm py-1">
                <span className="font-data-mono text-[9px] text-outline dark:text-zinc-500 font-bold uppercase hidden md:inline">SIMULATION</span>
                <button
                  onClick={() => setSimulationActive(!simulationActive)}
                  className={`w-8 h-4 rounded-full relative transition-colors duration-300 focus:outline-none ${simulationActive ? 'bg-secondary dark:bg-cyan-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                >
                  <span className={`absolute w-3 h-3 rounded-full bg-white dark:bg-zinc-950 top-0.5 transition-transform duration-300 transform shadow-sm ${simulationActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <span className={`font-data-mono text-[9px] font-bold ${simulationActive ? 'text-secondary dark:text-cyan-400' : 'text-outline dark:text-zinc-500'}`}>
                  {simulationActive ? 'ON' : 'OFF'}
                </span>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="w-8 h-8 rounded-full border border-outline-variant dark:border-zinc-800 flex items-center justify-center hover:bg-surface-container dark:hover:bg-zinc-800 transition-all"
              >
                <span className="material-symbols-outlined text-[18px] text-primary dark:text-zinc-200">
                  {theme === 'light' ? 'dark_mode' : 'light_mode'}
                </span>
              </button>

              <div className="flex items-center gap-xs">
                <div className={`w-2 h-2 rounded-full ${simulationActive ? 'bg-secondary dark:bg-cyan-400 pulse-indicator' : 'bg-zinc-400'}`} />
                <span className="font-data-mono text-[10px] text-on-surface dark:text-zinc-200 font-medium hidden sm:inline">
                  {simulationActive ? 'SYNCING_REALTIME' : 'SIMULATION_PAUSED'}
                </span>
              </div>

              <Button
                onClick={() => { triggerGenerateName(); setDeployModalOpen(true); }}
                variant="primary"
                size="sm"
                className="max-sm:px-md"
              >
                <span className="hidden sm:inline">DEPLOY NEW AGENT</span>
                <span className="sm:hidden">+ DEPLOY</span>
              </Button>
            </div>
          </header>

          {/* Dynamic Pane Display */}
          <div className="flex-1 flex min-h-0 overflow-hidden relative">
            
            {/* 1. DASHBOARD VIEW */}
            {currentView === 'dashboard' && (
              <div className="flex-1 flex flex-col xl:flex-row min-h-0 page-transition overflow-y-auto xl:overflow-hidden w-full">
                {/* Center Panel: Task stream */}
                <section className="flex-1 overflow-y-auto p-lg space-y-lg border-r border-outline-variant dark:border-zinc-800 max-xl:border-r-0 max-xl:border-b max-xl:flex-none">
                  <div className="flex justify-between items-end border-b border-outline-variant dark:border-zinc-800 pb-md">
                    <div>
                      <h1 className="font-headline text-2xl font-bold tracking-tighter dark:text-white">Market Activity</h1>
                      <p className="font-body text-sm text-on-surface-variant dark:text-zinc-400">Real-time autonomous agent task distribution & bidding stream.</p>
                    </div>
                    <div className="flex gap-sm">
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="appearance-none pl-md pr-lg py-1 bg-transparent border border-outline-variant dark:border-zinc-800 font-data-mono text-[11px] dark:text-zinc-300 rounded-sm cursor-pointer"
                      >
                        <option value="ALL" className="dark:bg-zinc-900">FILTER: ALL</option>
                        <option value="Security" className="dark:bg-zinc-900">FILTER: Security</option>
                        <option value="DeFi" className="dark:bg-zinc-900">FILTER: DeFi</option>
                        <option value="Data Mining" className="dark:bg-zinc-900">FILTER: Data Mining</option>
                        <option value="Strategy" className="dark:bg-zinc-900">FILTER: Strategy</option>
                        <option value="Infrastructure" className="dark:bg-zinc-900">FILTER: Infrastructure</option>
                      </select>
                      <select
                        value={sortFilter}
                        onChange={(e) => setSortFilter(e.target.value)}
                        className="appearance-none pl-md pr-lg py-1 bg-transparent border border-outline-variant dark:border-zinc-800 font-data-mono text-[11px] dark:text-zinc-300 rounded-sm cursor-pointer"
                      >
                        <option value="REWARD_DESC" className="dark:bg-zinc-900">SORT: REWARD (HIGH)</option>
                        <option value="REWARD_ASC" className="dark:bg-zinc-900">SORT: REWARD (LOW)</option>
                        <option value="BIDS_DESC" className="dark:bg-zinc-900">SORT: ACTIVE BIDS</option>
                        <option value="NEWEST" className="dark:bg-zinc-900">SORT: JUST POSTED</option>
                      </select>
                    </div>
                  </div>

                  {/* Search input */}
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-outline dark:text-zinc-500">search</span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search tasks by ID, title, or keywords..."
                      className="w-full pl-10 pr-4 py-2 bg-surface-container-low dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-secondary dark:focus:ring-cyan-400 transition-all placeholder:text-outline/70"
                    />
                  </div>

                  {/* Grid Cards */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-lg">
                    {filteredTasks.length === 0 ? (
                      <div className="col-span-2 py-xl text-center text-outline dark:text-zinc-500 text-sm">
                        No matching distributed computing tasks active.
                      </div>
                    ) : (
                      filteredTasks.map(task => (
                        <div
                          key={task.id}
                          className="group relative bg-surface-container-lowest dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 hover:border-primary dark:hover:border-zinc-400 p-md rounded-lg transition-all bg-gradient-to-br from-surface-container-lowest to-surface-container-low/50 dark:from-zinc-900 dark:to-zinc-950 backdrop-blur-sm shadow-sm select-none page-transition"
                        >
                          <div className="absolute top-md right-md flex gap-2 items-center">
                            <div className={`w-2 h-2 rounded-full pulse-indicator ${task.status === 'NEW' ? 'bg-primary dark:bg-white' : 'bg-secondary dark:bg-cyan-400'}`} />
                            <div className={`absolute inset-0 w-2 h-2 rounded-full animate-ping-subtle opacity-75 ${task.status === 'NEW' ? 'bg-primary dark:bg-zinc-600' : 'bg-secondary dark:bg-cyan-500'}`} />
                          </div>

                          <div className="flex flex-col gap-sm">
                            <div>
                              <span className="font-data-mono text-[10px] text-outline dark:text-zinc-500">ID: {task.id}</span>
                              <h3 className="font-headline text-lg font-bold leading-tight group-hover:text-secondary dark:group-hover:text-cyan-400 transition-colors dark:text-white truncate pr-6">{task.title}</h3>
                            </div>
                            <div className="flex flex-wrap gap-xs">
                              {task.tags.map(tag => (
                                <span key={tag} className="px-2 py-0.5 bg-surface-container-low dark:bg-zinc-800 text-on-surface-variant dark:text-zinc-300 text-[10px] font-bold uppercase tracking-wider rounded-sm">{tag}</span>
                              ))}
                            </div>
                            <div className="mt-md flex items-end justify-between">
                              <div>
                                <p className="text-[10px] text-outline dark:text-zinc-500 font-bold uppercase">Reward</p>
                                <p className="font-data-mono text-lg text-primary dark:text-zinc-200 font-bold">{task.reward.toLocaleString()} {task.rewardType}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-outline dark:text-zinc-500 font-bold uppercase">Bids</p>
                                <p className="font-data-mono text-base dark:text-zinc-300">{task.bids} Active</p>
                              </div>
                            </div>
                            <div className="mt-sm pt-sm border-t border-outline-variant/30 dark:border-zinc-800/50 flex justify-between items-center">
                              <span className={`text-[10px] font-bold uppercase tracking-widest ${task.status === 'NEW' ? 'text-primary dark:text-white' : 'text-secondary dark:text-cyan-400'}`}>
                                {task.status === 'NEW' ? 'JUST POSTED' : 'OPEN FOR BIDS'}
                              </span>
                              <button
                                onClick={() => { setSelectedTaskId(task.id); setManualAllocAgentId(agents[0]?.id || ''); setSpecsModalOpen(true); }}
                                className="text-xs font-bold underline underline-offset-4 hover:text-secondary dark:hover:text-cyan-400 transition-colors uppercase tracking-tighter dark:text-zinc-300"
                              >
                                VIEW SPECS
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {/* Sidebar modules panel */}
                <aside className="w-full xl:w-[360px] flex-shrink-0 flex flex-col bg-surface-container-low dark:bg-zinc-900 border-t xl:border-t-0 xl:border-l border-outline-variant dark:border-zinc-800 transition-colors max-xl:flex-none">
                  {/* Top: Active Agents */}
                  <div className="flex-1 xl:overflow-y-auto border-b border-outline-variant dark:border-zinc-800 max-xl:h-[400px]">
                    <div className="p-lg sticky top-0 bg-surface-container-low/95 dark:bg-zinc-900/95 backdrop-blur-md z-10 border-b border-outline-variant dark:border-zinc-800 flex justify-between items-center">
                      <div className="flex items-center gap-sm">
                        <span className="material-symbols-outlined text-[20px] text-primary dark:text-cyan-400 font-bold">groups</span>
                        <h2 className="font-label text-xs uppercase tracking-widest font-bold dark:text-white">Active Agent Network</h2>
                      </div>
                      <span className="font-data-mono text-[10px] text-secondary dark:text-cyan-400 font-bold hover:underline cursor-pointer" onClick={() => setView('agents')}>VIEW ALL</span>
                    </div>

                    <div className="px-lg py-md space-y-md">
                      {agents.map(agent => (
                        <div key={agent.id} className="p-md bg-surface-container-lowest dark:bg-zinc-950 border border-outline-variant dark:border-zinc-800 rounded-lg hover:border-primary dark:hover:border-zinc-600 transition-colors select-none">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-md">
                              <div className="w-10 h-10 bg-surface-container dark:bg-zinc-800 flex items-center justify-center rounded-sm text-primary dark:text-zinc-300">
                                <span className="material-symbols-outlined">{agent.avatar}</span>
                              </div>
                              <div>
                                <p className="font-label text-sm font-bold dark:text-white">{agent.name}</p>
                                <p className="font-data-mono text-[10px] text-outline dark:text-zinc-500">{agent.tier} Node</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-outline dark:text-zinc-500 font-bold">REP</p>
                              <p className="font-data-mono text-sm text-primary dark:text-zinc-200 font-bold">{agent.rep}</p>
                            </div>
                          </div>
                          <div className="mt-md flex justify-between items-center text-[10px] font-data-mono uppercase tracking-tighter">
                            <span className="text-on-surface-variant dark:text-zinc-400">Win Rate: {agent.winRate}%</span>
                            <button
                              onClick={() => { setSelectedAgentId(agent.id); setConfigStatus(agent.status); setConfigStrategy(agent.strategy); setConfigModalOpen(true); }}
                              className={`font-bold hover:underline cursor-pointer ${
                                agent.status === 'OFFLINE' ? 'text-error' : agent.status === 'IDLE_SCANNING' ? 'text-outline dark:text-zinc-500' : 'text-secondary dark:text-cyan-400'
                              }`}
                            >
                              {agent.status}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom: Live event log */}
                  <div className="h-[250px] overflow-hidden flex flex-col bg-inverse-surface dark:bg-black text-inverse-on-surface dark:text-zinc-300">
                    <div className="px-lg py-sm border-b border-white/10 flex justify-between items-center bg-black/20">
                      <div className="flex items-center gap-sm">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                        <span className="font-data-mono text-[10px] uppercase tracking-widest text-white">System_Event_Log <span className="opacity-40">[LIVE]</span></span>
                      </div>
                      <div className="flex items-center gap-sm">
                        <span className="font-data-mono text-[9px] px-1 border border-white/20 rounded-sm opacity-50 text-white">SYNC</span>
                        <span className="material-symbols-outlined text-[14px] opacity-70 text-white">terminal</span>
                      </div>
                    </div>

                    <div ref={terminalRef} className="flex-1 overflow-y-auto p-lg font-data-mono text-[10px] space-y-1.5 leading-relaxed bg-black/40 ring-inset ring-1 ring-white/5">
                      {events.map((log, i) => (
                        <div key={i} className="flex gap-md select-text">
                          <span className="opacity-40 shrink-0 text-white">{log.time}</span>
                          <span className={log.type === 'secondary' ? 'text-secondary-fixed dark:text-cyan-400' : log.type === 'primary' ? 'text-primary-fixed dark:text-zinc-400' : log.type === 'error' ? 'text-red-400' : 'text-white'}>
                            {log.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>
              </div>
            )}

            {/* 2. LIVE TASK MARKET VIEW */}
            {currentView === 'market' && (
              <div className="flex-1 overflow-y-auto p-lg space-y-lg page-transition">
                <div className="flex justify-between items-end border-b border-outline-variant dark:border-zinc-800 pb-md">
                  <div>
                    <h1 className="font-headline text-2xl font-bold tracking-tighter dark:text-white">Live Task Market</h1>
                    <p className="font-body text-sm text-on-surface-variant dark:text-zinc-400">Deploy, inspect, and request specs for distributed computing tasks.</p>
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-lg">
                  {/* Grid Left */}
                  <div className="flex-1 space-y-md">
                    <div className="flex gap-md">
                      <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-outline dark:text-zinc-500">search</span>
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search catalog..."
                          className="w-full pl-10 pr-4 py-2 bg-surface-container-low dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-secondary dark:focus:ring-cyan-400"
                        />
                      </div>
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="bg-surface-container-low dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 text-xs font-data-mono px-md py-2 rounded-lg dark:text-zinc-300"
                      >
                        <option value="ALL">ALL CATEGORIES</option>
                        <option value="Security">SECURITY</option>
                        <option value="DeFi">DEFI</option>
                        <option value="Data Mining">DATA MINING</option>
                        <option value="Strategy">STRATEGY</option>
                        <option value="Infrastructure">INFRASTRUCTURE</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                      {filteredTasks.map(task => (
                        <div key={task.id} className="p-md bg-surface-container-lowest dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 hover:border-secondary dark:hover:border-cyan-500 rounded-xl space-y-md transition-all shadow-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-data-mono text-[9px] text-outline dark:text-zinc-500">ID: {task.id}</span>
                              <h4 className="font-headline font-bold text-md dark:text-white">{task.title}</h4>
                            </div>
                            <span className="px-2 py-0.5 bg-secondary/10 dark:bg-cyan-500/20 text-secondary dark:text-cyan-400 text-[10px] font-bold uppercase rounded-sm">{task.category}</span>
                          </div>
                          <p className="text-xs text-on-surface-variant dark:text-zinc-400 line-clamp-2">{task.desc}</p>
                          <div className="flex justify-between items-center pt-md border-t border-outline-variant dark:border-zinc-800">
                            <div>
                              <span className="text-[9px] text-outline dark:text-zinc-500 font-bold uppercase">Locked Pool Reward</span>
                              <p className="font-data-mono text-md font-bold text-primary dark:text-zinc-200">{task.reward.toLocaleString()} {task.rewardType}</p>
                            </div>
                            <Button
                              onClick={() => { setSelectedTaskId(task.id); setManualAllocAgentId(agents[0]?.id || ''); setSpecsModalOpen(true); }}
                              variant="primary"
                              size="sm"
                            >
                              SPEC DETAILS
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Form right */}
                  <div className="w-full lg:w-[340px] flex-shrink-0 bg-surface-container-low dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 p-lg rounded-xl h-fit space-y-lg shadow-sm">
                    <div>
                      <h3 className="font-headline text-md font-bold tracking-tight dark:text-white">Post Computational Task</h3>
                      <p className="text-xs text-on-surface-variant dark:text-zinc-400">Lock reward assets in smart escrow to summon agents.</p>
                    </div>

                    <form onSubmit={handlePostTask} className="space-y-md">
                      <div className="space-y-xs">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-outline dark:text-zinc-400">Task Title</label>
                        <input
                          required
                          type="text"
                          value={postTitle}
                          onChange={(e) => setPostTitle(e.target.value)}
                          placeholder="e.g. AMM Stress Analysis"
                          className="w-full px-md py-2 bg-surface-container-lowest dark:bg-zinc-950 border border-outline-variant dark:border-zinc-800 rounded-lg text-xs dark:text-zinc-200"
                        />
                      </div>
                      <div className="space-y-xs">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-outline dark:text-zinc-400">Category</label>
                        <select
                          value={postCategory}
                          onChange={(e) => setPostCategory(e.target.value)}
                          className="w-full px-md py-2 bg-surface-container-lowest dark:bg-zinc-950 border border-outline-variant dark:border-zinc-800 rounded-lg text-xs dark:text-zinc-300"
                        >
                          <option value="Security">Security Audit</option>
                          <option value="DeFi">DeFi & Trading</option>
                          <option value="Data Mining">Data Mining & AI</option>
                          <option value="Strategy">Route Optimization</option>
                          <option value="Infrastructure">Infrastructure Test</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-md">
                        <div className="space-y-xs">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-outline dark:text-zinc-400">Reward</label>
                          <input
                            required
                            type="number"
                            step="any"
                            value={postReward}
                            onChange={(e) => setPostReward(parseFloat(e.target.value))}
                            placeholder="0.5"
                            className="w-full px-md py-2 bg-surface-container-lowest dark:bg-zinc-950 border border-outline-variant dark:border-zinc-800 rounded-lg text-xs dark:text-zinc-200"
                          />
                        </div>
                        <div className="space-y-xs">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-outline dark:text-zinc-400">Asset</label>
                          <select
                            value={postAsset}
                            onChange={(e) => setPostAsset(e.target.value as 'ETH' | 'USDC')}
                            className="w-full px-md py-2 bg-surface-container-lowest dark:bg-zinc-950 border border-outline-variant dark:border-zinc-800 rounded-lg text-xs dark:text-zinc-300"
                          >
                            <option value="ETH">ETH</option>
                            <option value="USDC">USDC</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-xs">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-outline dark:text-zinc-400">Technical Specifications</label>
                        <textarea
                          required
                          value={postDesc}
                          onChange={(e) => setPostDesc(e.target.value)}
                          placeholder="Describe task scope, requirements, inputs..."
                          rows={4}
                          className="w-full px-md py-2 bg-surface-container-lowest dark:bg-zinc-950 border border-outline-variant dark:border-zinc-800 rounded-lg text-xs dark:text-zinc-200"
                        />
                      </div>

                      <Button type="submit" variant="primary" fullWidth>
                        BROADCAST & DEPOSIT
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* 3. AGENT NETWORK DIAGNOSTICS VIEW */}
            {currentView === 'agents' && (
              <div className="flex-1 overflow-y-auto p-lg space-y-lg page-transition">
                <div className="flex justify-between items-center border-b border-outline-variant dark:border-zinc-800 pb-md">
                  <div>
                    <h1 className="font-headline text-2xl font-bold tracking-tighter dark:text-white">Active Agent Network</h1>
                    <p className="font-body text-sm text-on-surface-variant dark:text-zinc-400">Manage autonomous computational modules. Upgrade configurations or decommission active runtimes.</p>
                  </div>
                  <Button onClick={() => { triggerGenerateName(); setDeployModalOpen(true); }} variant="secondary">
                    DEPLOY AGENT NODE
                  </Button>
                </div>

                {/* Widgets stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-md">
                  <div className="p-md bg-surface-container-low dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 rounded-lg">
                    <p className="text-[10px] text-outline dark:text-zinc-500 font-bold uppercase">Runtimes Deployed</p>
                    <h3 className="font-headline text-2xl font-bold dark:text-white">{agents.length} Active</h3>
                  </div>
                  <div className="p-md bg-surface-container-low dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 rounded-lg">
                    <p className="text-[10px] text-outline dark:text-zinc-500 font-bold uppercase">Average Success Rate</p>
                    <h3 className="font-headline text-2xl font-bold dark:text-white">
                      {(agents.reduce((acc, a) => acc + a.winRate, 0) / agents.length || 0).toFixed(1)}%
                    </h3>
                  </div>
                  <div className="p-md bg-surface-container-low dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 rounded-lg">
                    <p className="text-[10px] text-outline dark:text-zinc-500 font-bold uppercase">Aggregated Reputation</p>
                    <h3 className="font-headline text-2xl font-bold dark:text-white">
                      {(agents.reduce((acc, a) => acc + a.rep, 0) / agents.length || 0).toFixed(1)} REP
                    </h3>
                  </div>
                  <div className="p-md bg-surface-container-low dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 rounded-lg">
                    <p className="text-[10px] text-outline dark:text-zinc-500 font-bold uppercase">Cumulative Earnings</p>
                    <h3 className="font-headline text-2xl font-bold dark:text-white text-emerald-400">
                      {agents.reduce((acc, a) => acc + a.earningsETH, 0).toFixed(2)} ETH
                    </h3>
                  </div>
                </div>

                {/* Agents Detail Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-lg">
                  {agents.map(agent => (
                    <div key={agent.id} className="bg-surface-container-low dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 p-lg rounded-xl space-y-md shadow-sm relative overflow-hidden page-transition">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-md">
                          <div className="w-12 h-12 rounded-lg bg-surface-container dark:bg-zinc-800 flex items-center justify-center text-primary dark:text-zinc-200">
                            <span className="material-symbols-outlined text-[24px]">{agent.avatar}</span>
                          </div>
                          <div>
                            <h4 className="font-headline font-bold text-sm dark:text-white">{agent.name}</h4>
                            <p className="font-data-mono text-[10px] text-outline dark:text-zinc-500">{agent.specialty} [{agent.tier}]</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-sm uppercase ${
                          agent.status === 'OFFLINE' ? 'bg-red-500/10 text-red-500' : agent.status === 'IDLE_SCANNING' ? 'bg-zinc-500/10 text-zinc-400' : 'bg-secondary/10 dark:bg-cyan-500/20 text-secondary dark:text-cyan-400'
                        }`}>{agent.status}</span>
                      </div>
                      <p className="text-xs text-on-surface-variant dark:text-zinc-400">{agent.description}</p>

                      {/* Rep bar */}
                      <div className="space-y-xs pt-sm">
                        <div className="flex justify-between text-[10px] font-data-mono">
                          <span className="text-outline dark:text-zinc-500">Reputation Level</span>
                          <span className="text-primary dark:text-zinc-300 font-bold">{agent.rep} / 100 REP</span>
                        </div>
                        <div className="w-full h-1.5 bg-surface-container dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-secondary dark:bg-cyan-400" style={{ width: `${agent.rep}%` }} />
                        </div>
                      </div>

                      {/* Earnings */}
                      <div className="grid grid-cols-2 gap-md text-xs font-data-mono border-t border-outline-variant dark:border-zinc-800 pt-md">
                        <div>
                          <span className="text-[9px] text-outline dark:text-zinc-500 font-bold block uppercase">Jobs Complete</span>
                          <span className="text-primary dark:text-zinc-200 font-bold">{agent.jobsCompleted} Jobs</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-outline dark:text-zinc-500 font-bold block uppercase">Earnings</span>
                          <span className="text-secondary dark:text-cyan-400 font-bold truncate block">{agent.earningsETH.toFixed(2)} ETH / ${agent.earningsUSDC}</span>
                        </div>
                      </div>

                      <div className="pt-md flex gap-md">
                        <Button
                          onClick={() => { setSelectedAgentId(agent.id); setConfigStatus(agent.status); setConfigStrategy(agent.strategy); setConfigModalOpen(true); }}
                          variant="outline"
                          fullWidth
                        >
                          CONFIGURE
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. ON-CHAIN EXPLORER VIEW */}
            {currentView === 'onchain' && (
              <div className="flex-1 flex flex-col lg:flex-row min-h-0 page-transition w-full">
                {/* Explorer Left */}
                <section className="flex-1 overflow-y-auto p-lg space-y-lg border-r border-outline-variant dark:border-zinc-800">
                  <div>
                    <h1 className="font-headline text-2xl font-bold tracking-tighter dark:text-white">On-chain activity Log</h1>
                    <p className="font-body text-sm text-on-surface-variant dark:text-zinc-400">Verifiable immutable block explorer for Taskra smart contract operations.</p>
                  </div>

                  <div className="border border-outline-variant dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-surface-container-low dark:bg-zinc-950 border-b border-outline-variant dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-outline dark:text-zinc-400 font-data-mono">
                          <th className="py-3 px-lg">Block</th>
                          <th className="py-3 px-md">Method</th>
                          <th className="py-3 px-md">Address / Target</th>
                          <th className="py-3 px-md">Gas Used</th>
                          <th className="py-3 px-md">Status</th>
                          <th className="py-3 px-lg text-right">Tx Hash</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant dark:divide-zinc-800 font-data-mono text-xs dark:text-zinc-300">
                        {onchainLogs.map((log, index) => (
                          <tr
                            key={index}
                            onClick={() => setSelectedTxIndex(index)}
                            className={`hover:bg-surface-container-low dark:hover:bg-zinc-800/50 cursor-pointer transition-colors ${selectedTxIndex === index ? 'bg-surface-container-high dark:bg-zinc-800' : ''}`}
                          >
                            <td className="py-3.5 px-lg text-primary dark:text-white font-bold">#{log.block.toLocaleString()}</td>
                            <td className="py-3.5 px-md font-bold">{log.method}</td>
                            <td className="py-3.5 px-md text-on-surface-variant dark:text-zinc-400">{log.target}</td>
                            <td className="py-3.5 px-md">{log.gas}</td>
                            <td className="py-3.5 px-md">
                              <span className="text-secondary dark:text-cyan-400 font-bold">{log.status}</span>
                            </td>
                            <td className="py-3.5 px-lg text-right text-outline dark:text-zinc-500">{log.hash}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Inspector right */}
                <aside className="w-full lg:w-[320px] flex-shrink-0 bg-surface-container-low dark:bg-zinc-900 p-lg overflow-y-auto flex flex-col gap-lg border-t lg:border-t-0 lg:border-l border-outline-variant dark:border-zinc-800">
                  <div>
                    <h3 className="font-label text-xs uppercase tracking-widest font-bold dark:text-white">Tx Receipt Inspector</h3>
                    <p className="text-[10px] text-on-surface-variant dark:text-zinc-400 mt-1">Select any verified transaction block to inspect payload metadata.</p>
                  </div>

                  <div className="flex-1 bg-black border border-outline-variant dark:border-zinc-800 rounded-lg p-md font-data-mono text-[10px] leading-relaxed text-zinc-300 overflow-y-auto min-h-[220px]">
                    {selectedTxIndex !== null && onchainLogs[selectedTxIndex] ? (
                      <pre className="whitespace-pre-wrap select-all text-emerald-400">
                        {JSON.stringify({
                          blockNumber: onchainLogs[selectedTxIndex].block,
                          transactionHash: onchainLogs[selectedTxIndex].hash + "de00a89d7d3d",
                          status: onchainLogs[selectedTxIndex].status,
                          methodCalled: onchainLogs[selectedTxIndex].method,
                          scopeTarget: onchainLogs[selectedTxIndex].target,
                          gasPrice: "34.2 Gwei",
                          gasLimit: "500,000",
                          gasUsed: onchainLogs[selectedTxIndex].gas,
                          sender: "0x71C24151a6E39b1B33e7dAdF4E18dF8E1Cb3e44b",
                          contractVerification: "VERIFIED_COMPILER_V0.8.20",
                          timestamp: "2026-05-19T14:00:00Z",
                          networkChainId: "taskra-mainnet-l2"
                        }, null, 4)}
                      </pre>
                    ) : (
                      <pre className="text-zinc-500">Select a row on the left to inspect block metadata.</pre>
                    )}
                  </div>
                </aside>
              </div>
            )}
          </div>

          {/* Bottom Footer Overviews */}
          <footer className="h-14 bg-surface-container dark:bg-zinc-900 border-t border-outline-variant dark:border-zinc-800 flex items-center px-lg justify-between transition-colors shrink-0">
            <div className="flex-1 flex divide-x divide-outline-variant dark:divide-zinc-800 overflow-x-auto select-none">
              
              <div className="px-xl first:pl-0 flex flex-col justify-center shrink-0">
                <p className="text-[9px] text-outline dark:text-zinc-500 font-bold uppercase tracking-widest mb-1">Total Rewards</p>
                <div className="flex items-end gap-md">
                  <div className="flex items-baseline gap-xs">
                    <span className="font-data-mono text-base text-primary dark:text-white font-bold">{stats.totalRewardsETH.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span className="text-[9px] font-bold text-on-surface-variant dark:text-zinc-400">ETH</span>
                  </div>
                  <svg className="w-12 h-6 text-secondary dark:text-cyan-400" fill="none" viewBox="0 0 100 40">
                    <path d={drawSparklineD(charts.rewards) + " L 100 40 L 0 40 Z"} fill="currentColor" fillOpacity="0.08" />
                    <path d={drawSparklineD(charts.rewards)} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
              </div>

              <div className="px-xl flex flex-col justify-center shrink-0">
                <p className="text-[9px] text-outline dark:text-zinc-500 font-bold uppercase tracking-widest mb-1">System Throughput</p>
                <div className="flex items-end gap-md">
                  <div className="flex items-baseline gap-xs">
                    <span className="font-data-mono text-base text-primary dark:text-white font-bold">{stats.tps.toFixed(1)}</span>
                    <span className="text-[9px] font-bold text-on-surface-variant dark:text-zinc-400">TPS</span>
                  </div>
                  <svg className="w-12 h-6 text-primary dark:text-zinc-300" fill="none" viewBox="0 0 100 40">
                    <path d={drawSparklineD(charts.tps) + " L 100 40 L 0 40 Z"} fill="currentColor" fillOpacity="0.08" />
                    <path d={drawSparklineD(charts.tps)} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
              </div>

              <div className="px-xl flex flex-col justify-center shrink-0">
                <p className="text-[9px] text-outline dark:text-zinc-500 font-bold uppercase tracking-widest">Global Success</p>
                <div className="flex items-baseline gap-xs mt-1">
                  <span className="font-data-mono text-base text-primary dark:text-white font-bold">{stats.successRate}</span>
                  <span className="text-[9px] font-bold text-on-surface-variant dark:text-zinc-400">%</span>
                </div>
              </div>

              <div className="px-xl flex flex-col justify-center shrink-0">
                <p className="text-[9px] text-outline dark:text-zinc-500 font-bold uppercase tracking-widest mb-1">Active Task Volume</p>
                <div className="flex items-end gap-md">
                  <div className="flex items-baseline gap-xs">
                    <span className="font-data-mono text-base text-primary dark:text-white font-bold">{stats.taskVolume}M</span>
                    <span className="text-[9px] font-bold text-on-surface-variant dark:text-zinc-400">USD</span>
                  </div>
                  <svg className="w-12 h-6 text-secondary dark:text-cyan-400" fill="none" viewBox="0 0 100 40">
                    <path d={drawSparklineD(charts.volume) + " L 100 40 L 0 40 Z"} fill="currentColor" fillOpacity="0.08" />
                    <path d={drawSparklineD(charts.volume)} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-md select-none shrink-0 pl-md border-l border-outline-variant dark:border-zinc-800 max-md:hidden">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full border-2 border-surface-container-highest dark:border-zinc-800 bg-surface-container dark:bg-zinc-800 overflow-hidden shadow-sm">
                  <img alt="agent" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDDDmJb6hxipPxT34O45kT7wPvidJ_3K4rqrkXOgnGBOMgTheHNSEWhgcH8GS7TSZ91xcwpxPOO_gpnZfTeuLzAJDz5ZW59Redo0OCq3DLr1tqLod8fLqtLwaYTlBtVw-INk78ldJkTSpjqyxG94w1jkhf5OxuRPNXHZjlBjYE9rcNpchh9pq1BL4BlHBUAC2Y_ghu8dwjNoTIkX5VJNvCBj6uyZX3sLaADkWbr7vmZ8ejzLNnnv3rMLFYFHmmUPjur7oizP4RiDTU" />
                </div>
                <div className="w-8 h-8 rounded-full border-2 border-surface-container-highest dark:border-zinc-800 bg-surface-container dark:bg-zinc-800 overflow-hidden shadow-sm">
                  <img alt="agent" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB9a5J_nPc7ikMVk59xn-3gROMYgXsD_KTw5SpbFgmfLNowrvdGask2cXE4oainiC8YuCFHyMJjISZmPo3-479xDonNslKR47Roo583415aaU6L7xh5b7yKxX6VBIQyfR3jbHiTzg9oJFAAD4nzdZO6gDzU9LE7G6iFAx5ADN_6ly-QOcV-BXwAkJz9C3yr20vkJBf59e92IOQGTNr0S69I0-fytLUgOa3Spy46zzvB4ZhnsWUci2Yb1aEDhDWhpGu9s3g44_SRam8" />
                </div>
                <div className="w-8 h-8 rounded-full border-2 border-surface-container-highest dark:border-zinc-800 bg-surface-container dark:bg-zinc-800 overflow-hidden shadow-sm">
                  <img alt="agent" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBSZpFy2GvimsiLDSZvuNmtIiCbHPDW_wqoQRsI20TtLzH3TjHeoR7EBO4kKyWR5sXF7a_lMc1IJuaiXluwJ7og2pr5ri7_BgVd_zV4lwJT6d4ZxqQaz3WjgUx8GoIgef6F5oPr1PQgFTGIK-oA85JrNgSADS_5MnDG-OF58pqrSXb0ctBihxUUm7ruLXhjembUbQ9l1aiRb_5QbfPqbQHPZwWZRiIHZhwihJ1Nj4ybh9c394yQLFuxoxlJ8Gs7CvnCO0h54HFzMp4" />
                </div>
              </div>
              <span className="font-label text-[11px] font-bold text-on-surface-variant dark:text-zinc-400">+1.4k Agents Online</span>
            </div>
          </footer>
        </main>
      </div>

      {/* --- MODALS --- */}
      {/* 1. DEPLOY AGENT MODAL */}
      {deployModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-md">
          <div className="bg-surface dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 w-full max-w-[450px] rounded-xl overflow-hidden shadow-xl page-transition">
            <header className="p-lg border-b border-outline-variant dark:border-zinc-800 flex justify-between items-center bg-surface-container-low dark:bg-zinc-950">
              <div className="flex items-center gap-sm">
                <span className="material-symbols-outlined text-secondary dark:text-cyan-400">deployed_code</span>
                <h3 className="font-headline font-bold text-lg dark:text-white">Deploy Autonomous Agent</h3>
              </div>
              <button onClick={() => setDeployModalOpen(false)} className="material-symbols-outlined text-outline dark:text-zinc-400 hover:text-primary dark:hover:text-white">close</button>
            </header>

            <form onSubmit={handleDeployAgent} className="p-lg space-y-md">
              <div className="space-y-xs">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-outline dark:text-zinc-400">Agent Name</label>
                  <button type="button" onClick={triggerGenerateName} className="text-[10px] text-secondary dark:text-cyan-400 hover:underline">🎲 Generate Name</button>
                </div>
                <input
                  required
                  type="text"
                  value={deployName}
                  onChange={(e) => setDeployName(e.target.value)}
                  placeholder="e.g. Sentinel_Aether"
                  className="w-full px-md py-2 bg-surface-container-lowest dark:bg-zinc-950 border border-outline-variant dark:border-zinc-800 rounded-lg text-sm dark:text-zinc-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-md">
                <div className="space-y-xs">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-outline dark:text-zinc-400">Specialty</label>
                  <select
                    value={deploySpecialty}
                    onChange={(e) => setDeploySpecialty(e.target.value)}
                    className="w-full px-md py-2 bg-surface-container-lowest dark:bg-zinc-950 border border-outline-variant dark:border-zinc-800 rounded-lg text-xs dark:text-zinc-300"
                  >
                    <option value="Security Auditor">Security Auditor</option>
                    <option value="Data Analyst">Data Analyst</option>
                    <option value="Arb Specialist">Arb Specialist</option>
                    <option value="Node Latency Tester">Node Latency Tester</option>
                  </select>
                </div>
                <div className="space-y-xs">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-outline dark:text-zinc-400">Performance Tier</label>
                  <select
                    value={deployTier}
                    onChange={(e) => setDeployTier(e.target.value as any)}
                    className="w-full px-md py-2 bg-surface-container-lowest dark:bg-zinc-950 border border-outline-variant dark:border-zinc-800 rounded-lg text-xs dark:text-zinc-300"
                  >
                    <option value="Standard">Standard (0.05 ETH)</option>
                    <option value="Advanced">Advanced (0.15 ETH)</option>
                    <option value="Elite">Elite (0.50 ETH)</option>
                  </select>
                </div>
              </div>

              <div className="p-md bg-surface-container-low dark:bg-zinc-950 border border-outline-variant dark:border-zinc-800 rounded-lg space-y-xs">
                <p className="text-[10px] text-outline dark:text-zinc-500 font-bold uppercase">Deployment Diagnostics</p>
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant dark:text-zinc-400">Baseline Reputation</span>
                  <span className="font-data-mono dark:text-zinc-200 font-medium">
                    {deployTier === 'Standard' ? '75.0' : deployTier === 'Advanced' ? '88.0' : '96.0'} REP
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant dark:text-zinc-400">Escrow Contract Gas</span>
                  <span className="font-data-mono text-secondary dark:text-cyan-400 font-medium">FREE (L2 Sandbox)</span>
                </div>
              </div>

              <div className="flex gap-md pt-md">
                <Button onClick={() => setDeployModalOpen(false)} variant="outline" fullWidth type="button">Cancel</Button>
                <Button type="submit" variant="primary" fullWidth>Confirm & Deploy</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. ESCROW WALLET MODAL */}
      {walletModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-md">
          <div className="bg-surface dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 w-full max-w-[460px] rounded-xl overflow-hidden shadow-xl page-transition">
            <header className="p-lg border-b border-outline-variant dark:border-zinc-800 flex justify-between items-center bg-surface-container-low dark:bg-zinc-950">
              <div className="flex items-center gap-sm">
                <span className="material-symbols-outlined text-secondary dark:text-cyan-400">account_balance_wallet</span>
                <h3 className="font-headline font-bold text-lg dark:text-white">Escrow Wallet Node</h3>
              </div>
              <button onClick={() => setWalletModalOpen(false)} className="material-symbols-outlined text-outline dark:text-zinc-400 hover:text-primary dark:hover:text-white">close</button>
            </header>

            <div className="p-lg space-y-lg">
              <div className="space-y-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-outline dark:text-zinc-500">Node Public Key</span>
                <div className="flex gap-md bg-surface-container-lowest dark:bg-zinc-950 p-md border border-outline-variant dark:border-zinc-800 rounded-lg">
                  <span className="font-data-mono text-xs dark:text-zinc-200 select-all truncate flex-1">{wallet.fullAddress}</span>
                  <button onClick={() => { navigator.clipboard.writeText(wallet.fullAddress); alert("Address copied!"); }} className="material-symbols-outlined text-[18px] text-outline hover:text-primary dark:hover:text-white">content_copy</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-md">
                <div className="p-md bg-surface-container-low dark:bg-zinc-950 border border-outline-variant dark:border-zinc-800 rounded-lg">
                  <span className="text-[9px] font-bold text-outline dark:text-zinc-500 uppercase tracking-wider">ETH Balance</span>
                  <h4 className="font-data-mono text-lg font-bold dark:text-white mt-1">{wallet.balanceETH.toFixed(2)} ETH</h4>
                </div>
                <div className="p-md bg-surface-container-low dark:bg-zinc-950 border border-outline-variant dark:border-zinc-800 rounded-lg">
                  <span className="text-[9px] font-bold text-outline dark:text-zinc-500 uppercase tracking-wider">USDC Balance</span>
                  <h4 className="font-data-mono text-lg font-bold dark:text-white mt-1">{wallet.balanceUSDC.toLocaleString()} USDC</h4>
                </div>
              </div>

              <div className="p-md bg-secondary/5 dark:bg-cyan-500/5 border border-secondary/20 dark:border-cyan-500/20 rounded-lg flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-secondary dark:text-cyan-400">L2 Sandboxed Faucet</h5>
                  <p className="text-[10px] text-on-surface-variant dark:text-zinc-400">Request free gas and test tokens for bidding.</p>
                </div>
                <Button onClick={triggerFaucet} variant="secondary" size="sm">CLAIM TOKENS</Button>
              </div>

              <div className="space-y-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-outline dark:text-zinc-500">Transaction History</span>
                <div className="max-h-[140px] overflow-y-auto divide-y divide-outline-variant dark:divide-zinc-800 border border-outline-variant dark:border-zinc-800 rounded-lg">
                  {wallet.transactions.map((tx, idx) => (
                    <div key={idx} className="flex justify-between items-center p-md hover:bg-surface-container-low dark:hover:bg-zinc-800 transition-colors">
                      <div>
                        <p className="text-xs font-bold dark:text-zinc-200">{tx.type}</p>
                        <p className="font-data-mono text-[9px] text-outline dark:text-zinc-500">{tx.time} | Tx: {tx.hash}</p>
                      </div>
                      <span className={`font-data-mono text-xs font-bold ${tx.type.includes('Reward') || tx.type.includes('Faucet') ? 'text-secondary dark:text-cyan-400' : 'text-primary dark:text-white'}`}>
                        {tx.type.includes('Reward') || tx.type.includes('Faucet') ? '+' : '-'}{tx.amount} {tx.asset}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. TASK SPECS AND MANUAL BIDDING MODAL */}
      {specsModalOpen && activeSpecsTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-md">
          <div className="bg-surface dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 w-full max-w-[550px] rounded-xl overflow-hidden shadow-xl page-transition">
            <header className="p-lg border-b border-outline-variant dark:border-zinc-800 flex justify-between items-center bg-surface-container-low dark:bg-zinc-950">
              <div className="flex items-center gap-sm">
                <span className="material-symbols-outlined text-secondary dark:text-cyan-400">terminal</span>
                <h3 className="font-headline font-bold text-lg dark:text-white">Task Specification</h3>
              </div>
              <button onClick={() => setSpecsModalOpen(false)} className="material-symbols-outlined text-outline dark:text-zinc-400 hover:text-primary dark:hover:text-white">close</button>
            </header>

            <div className="p-lg space-y-md max-h-[500px] overflow-y-auto">
              <div className="flex justify-between items-start">
                <div className="space-y-xs">
                  <span className="font-data-mono text-[10px] text-outline dark:text-zinc-500">ID: {activeSpecsTask.id}</span>
                  <h4 className="font-headline text-lg font-bold dark:text-white">{activeSpecsTask.title}</h4>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-sm ${activeSpecsTask.status === 'NEW' ? 'bg-primary dark:bg-white text-on-primary dark:text-zinc-900' : 'bg-secondary/15 text-secondary dark:text-cyan-400'}`}>
                  {activeSpecsTask.status === 'NEW' ? 'JUST POSTED' : 'OPEN FOR BIDS'}
                </span>
              </div>

              <div className="flex flex-wrap gap-xs">
                {activeSpecsTask.tags.map(t => (
                  <span key={t} className="px-2 py-0.5 bg-surface-container-low dark:bg-zinc-800 text-[9px] font-bold uppercase dark:text-zinc-300 rounded-sm">{t}</span>
                ))}
              </div>

              <div className="space-y-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-outline dark:text-zinc-500">Scope Description</span>
                <p className="text-xs text-on-surface-variant dark:text-zinc-300 bg-surface-container-low dark:bg-zinc-950 p-md border border-outline-variant dark:border-zinc-800 rounded-lg leading-relaxed">
                  {activeSpecsTask.desc}
                </p>
              </div>

              <div className="space-y-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-outline dark:text-zinc-500">Compilation Specifications</span>
                <pre className="font-data-mono text-[10.5px] text-on-surface dark:text-zinc-300 bg-surface-container-low dark:bg-zinc-950 border border-outline-variant dark:border-zinc-800 p-md rounded-lg overflow-x-auto leading-relaxed">
                  {activeSpecsTask.specs}
                </pre>
              </div>

              {/* Allocation panel */}
              <div className="p-md bg-secondary/5 dark:bg-cyan-500/5 border border-secondary/20 dark:border-cyan-500/20 rounded-lg space-y-md">
                <div>
                  <h5 className="text-xs font-bold text-secondary dark:text-cyan-400">Manual Agent Allocation</h5>
                  <p className="text-[10px] text-on-surface-variant dark:text-zinc-400 mt-1">Assign one of your idle networks to execute this computational job.</p>
                </div>
                <div className="flex gap-md items-end">
                  <div className="flex-1 space-y-xs">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-outline dark:text-zinc-500">Select Deployed Agent</label>
                    <select
                      value={manualAllocAgentId}
                      onChange={(e) => setManualAllocAgentId(e.target.value)}
                      className="w-full px-md py-1.5 bg-surface-container-lowest dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 rounded-lg text-xs dark:text-zinc-300"
                    >
                      {agents.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.tier} - {a.specialty})</option>
                      ))}
                    </select>
                  </div>
                  <Button onClick={handleManualAllocation} variant="primary">
                    ALLOCATE RUNTIME
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. AGENT CONFIGURATION DRAWER / MODAL */}
      {configModalOpen && activeConfigAgent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-md">
          <div className="bg-surface dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 w-full max-w-[450px] rounded-xl overflow-hidden shadow-xl page-transition">
            <header className="p-lg border-b border-outline-variant dark:border-zinc-800 flex justify-between items-center bg-surface-container-low dark:bg-zinc-950">
              <div className="flex items-center gap-sm">
                <span className="material-symbols-outlined text-secondary dark:text-cyan-400">tune</span>
                <h3 className="font-headline font-bold text-lg dark:text-white">Configure {activeConfigAgent.name}</h3>
              </div>
              <button onClick={() => setConfigModalOpen(false)} className="material-symbols-outlined text-outline dark:text-zinc-400 hover:text-primary dark:hover:text-white">close</button>
            </header>

            <div className="p-lg space-y-lg">
              <div className="grid grid-cols-2 gap-md">
                <div className="space-y-xs">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-outline dark:text-zinc-500 font-data-mono">Runtime Status</label>
                  <select
                    value={configStatus}
                    onChange={(e) => setConfigStatus(e.target.value as any)}
                    className="w-full px-md py-1.5 bg-surface-container-lowest dark:bg-zinc-950 border border-outline-variant dark:border-zinc-800 rounded-lg text-xs dark:text-zinc-300"
                  >
                    <option value="ACTIVE_BIDDING">ACTIVE BIDDING</option>
                    <option value="IDLE_SCANNING">IDLE SCANNING</option>
                    <option value="OFFLINE">OFFLINE (SLEEP)</option>
                  </select>
                </div>
                <div className="space-y-xs">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-outline dark:text-zinc-500 font-data-mono">Bidding Strategy</label>
                  <select
                    value={configStrategy}
                    onChange={(e) => setConfigStrategy(e.target.value as any)}
                    className="w-full px-md py-1.5 bg-surface-container-lowest dark:bg-zinc-950 border border-outline-variant dark:border-zinc-800 rounded-lg text-xs dark:text-zinc-300"
                  >
                    <option value="Balanced">Balanced Strategy</option>
                    <option value="Aggressive">Aggressive (High Yield)</option>
                    <option value="Conservative">Conservative (Low Gas)</option>
                  </select>
                </div>
              </div>

              <div className="p-md bg-surface-container-low dark:bg-zinc-950 border border-outline-variant dark:border-zinc-800 rounded-lg space-y-xs">
                <p className="text-[10px] text-outline dark:text-zinc-500 font-bold uppercase">Aggregated Telemetry</p>
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant dark:text-zinc-400">Total Solved Jobs</span>
                  <span className="font-data-mono dark:text-zinc-200 font-medium">{activeConfigAgent.jobsCompleted} Jobs</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant dark:text-zinc-400">Aggregated Earnings</span>
                  <span className="font-data-mono text-secondary dark:text-cyan-400 font-medium">
                    {activeConfigAgent.earningsETH.toFixed(2)} ETH + ${activeConfigAgent.earningsUSDC}
                  </span>
                </div>
              </div>

              {activeConfigAgent.tier !== 'Elite' && (
                <div className="p-md border border-outline-variant dark:border-zinc-800 rounded-lg space-y-sm">
                  <div>
                    <h5 className="text-xs font-bold dark:text-white">Upgrade Computing Engine</h5>
                    <p className="text-[10px] text-on-surface-variant dark:text-zinc-400 mt-1">Upgrade processing tier to increase execution speed and reputation score limit.</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-outline dark:text-zinc-500 font-bold">NEXT UPGRADE</span>
                      <p className="text-xs font-bold text-secondary dark:text-cyan-400">
                        {activeConfigAgent.tier === 'Standard' ? 'Advanced Node' : 'Elite Node'}
                      </p>
                    </div>
                    <Button onClick={upgradeAgentTier} variant="primary" size="sm">
                      UPGRADE ({activeConfigAgent.tier === 'Standard' ? '0.10 ETH' : '0.35 ETH'})
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-md border-t border-outline-variant dark:border-zinc-800 pt-md">
                <Button onClick={decommissionAgent} variant="danger" fullWidth>
                  Decommission Node (Refund 50%)
                </Button>
                <Button onClick={saveAgentConfig} variant="primary" fullWidth>
                  Save Status Configs
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
