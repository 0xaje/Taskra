import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import Head from 'next/head';
import { Button } from '@taskra/ui';
import { Agent, Task, BlockchainTx, SystemStats, SystemEventLog, WalletInfo } from '@taskra/types';

function NetworkVisualizer({ agents, crisisState, civilizationStability }: { agents: Agent[]; crisisState: 'STABLE' | 'COLLAPSE' | 'RECOVERY'; civilizationStability: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;
    canvas.width = width;
    canvas.height = height;

    const resizeObserver = new ResizeObserver(() => {
      if (canvas) {
        width = canvas.offsetWidth;
        height = canvas.offsetHeight;
        canvas.width = width;
        canvas.height = height;
      }
    });
    resizeObserver.observe(canvas);

    interface VisualNode {
      x: number;
      y: number;
      radius: number;
      name: string;
      color: string;
      pulse: number;
    }

    interface Packet {
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      progress: number;
      speed: number;
      color: string;
    }

    const visualNodes: VisualNode[] = [];
    const packets: Packet[] = [];

    const updateNodes = () => {
      visualNodes.length = 0;
      if (agents.length === 0) return;
      
      agents.forEach((agent, index) => {
        const angle = (index / agents.length) * Math.PI * 2;
        const radius = Math.min(width, height) * 0.28;
        
        let nodeColor = '#22d3ee';
        if (crisisState === 'COLLAPSE') {
          nodeColor = '#ef4444';
        } else if (crisisState === 'RECOVERY') {
          nodeColor = '#fbbf24';
        } else if (agent.status === 'OFFLINE') {
          nodeColor = '#ef4444';
        } else if (agent.status === 'IDLE_SCANNING') {
          nodeColor = '#71717a';
        }

        visualNodes.push({
          x: width / 2 + Math.cos(angle) * radius,
          y: height / 2 + Math.sin(angle) * radius,
          radius: agent.tier === 'Elite' ? 10 : agent.tier === 'Advanced' ? 8 : 6,
          name: agent.name,
          color: nodeColor,
          pulse: 0
        });
      });
    };

    updateNodes();

    let spawnTimer = 0;
    let shockwaveRadius = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw red stress fractures if in COLLAPSE state
      if (crisisState === 'COLLAPSE') {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.12)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, height * 0.3);
        ctx.lineTo(width * 0.4, height * 0.45);
        ctx.lineTo(width * 0.6, height * 0.25);
        ctx.lineTo(width, height * 0.4);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(width * 0.2, height);
        ctx.lineTo(width * 0.35, height * 0.6);
        ctx.lineTo(width * 0.7, height * 0.75);
        ctx.lineTo(width * 0.85, 0);
        ctx.stroke();
      }

      // 2. Draw background network connections
      if (crisisState === 'COLLAPSE') {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.18)';
        ctx.setLineDash([2, 6]);
      } else if (crisisState === 'RECOVERY') {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.15)';
        ctx.setLineDash([4, 4]);
      } else {
        ctx.strokeStyle = 'rgba(113, 113, 122, 0.08)';
        ctx.setLineDash([]);
      }
      
      ctx.lineWidth = 1;
      for (let i = 0; i < visualNodes.length; i++) {
        for (let j = i + 1; j < visualNodes.length; j++) {
          if (crisisState === 'COLLAPSE' && (i + j) % 3 === 0) continue;
          
          ctx.beginPath();
          ctx.moveTo(visualNodes[i].x, visualNodes[i].y);
          ctx.lineTo(visualNodes[j].x, visualNodes[j].y);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);

      // 3. Draw shockwave rings in COLLAPSE
      if (crisisState === 'COLLAPSE') {
        shockwaveRadius += 3;
        if (shockwaveRadius > Math.max(width, height)) {
          shockwaveRadius = 0;
        }
        ctx.strokeStyle = `rgba(239, 68, 68, ${Math.max(0, 1 - shockwaveRadius / Math.max(width, height)) * 0.25})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, shockwaveRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 4. Update & Draw Packets
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i];
        p.progress += p.speed;
        if (p.progress >= 1) {
          packets.splice(i, 1);
          continue;
        }

        const currentX = p.startX + (p.endX - p.startX) * p.progress;
        const currentY = p.startY + (p.endY - p.startY) * p.progress;

        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(currentX, currentY, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 5. Update & Draw Nodes
      visualNodes.forEach((node) => {
        let jitterX = 0;
        let jitterY = 0;
        if (crisisState === 'COLLAPSE') {
          jitterX = (Math.random() - 0.5) * 5;
          jitterY = (Math.random() - 0.5) * 5;
          node.pulse += 0.18;
        } else {
          node.pulse += 0.05;
        }

        const nodeX = node.x + jitterX;
        const nodeY = node.y + jitterY;
        
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(nodeX, nodeY, node.radius + Math.sin(node.pulse) * (crisisState === 'COLLAPSE' ? 5 : 3) + 3, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(nodeX, nodeY, node.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = crisisState === 'COLLAPSE' ? '#f87171' : crisisState === 'RECOVERY' ? '#fcd34d' : '#a1a1aa';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(node.name, nodeX, nodeY - node.radius - 4);
      });

      spawnTimer++;
      if (spawnTimer > (crisisState === 'COLLAPSE' ? 12 : 35) && visualNodes.length > 1) {
        spawnTimer = 0;
        const startIndex = Math.floor(Math.random() * visualNodes.length);
        let endIndex = Math.floor(Math.random() * visualNodes.length);
        while (endIndex === startIndex) {
          endIndex = Math.floor(Math.random() * visualNodes.length);
        }

        const start = visualNodes[startIndex];
        const end = visualNodes[endIndex];

        let pColor = '#22d3ee';
        if (crisisState === 'COLLAPSE') pColor = '#ef4444';
        else if (crisisState === 'RECOVERY') pColor = '#fbbf24';

        packets.push({
          startX: start.x,
          startY: start.y,
          endX: end.x,
          endY: end.y,
          progress: 0,
          speed: (crisisState === 'COLLAPSE' ? 0.024 : 0.012) + Math.random() * 0.018,
          color: pColor
        });
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
    };
  }, [agents, crisisState]);

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}

export default function Home() {
  // --- Synth Audio Engine ---
  const playSynthSound = (type: 'collapse' | 'recovery' | 'click' | 'success') => {
    if (typeof window === 'undefined') return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      if (type === 'collapse') {
        // Deep Ominous Analog Bass Sweep
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.type = 'sawtooth';
        osc2.type = 'triangle';
        
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 2.5);
        
        osc2.frequency.setValueAtTime(60, ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(15, ctx.currentTime + 2.5);
        
        gainNode.gain.setValueAtTime(0.35, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2.5);
        
        osc.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.start();
        osc2.start();
        osc.stop(ctx.currentTime + 2.5);
        osc2.stop(ctx.currentTime + 2.5);
      } 
      else if (type === 'recovery') {
        // Sparkling high-frequency major-chord arpeggio
        const playTone = (freq: number, start: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
          gainNode.gain.setValueAtTime(0, ctx.currentTime + start);
          gainNode.gain.linearRampToValueAtTime(0.18, ctx.currentTime + start + 0.05);
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + duration);
        };
        
        playTone(523.25, 0.0, 1.2); // C5
        playTone(659.25, 0.15, 1.2); // E5
        playTone(783.99, 0.3, 1.2); // G5
        playTone(1046.50, 0.45, 1.5); // C6
      }
      else if (type === 'success') {
        // Crisp digital glass chime resolved
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.08);
        
        gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
      }
      else if (type === 'click') {
        // Subtle, short high-frequency tick for user action
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }
    } catch (e) {
      // Audio fallback safe
    }
  };

  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([]);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // --- Core State ---
  const [currentView, setView] = useState<'civilization' | 'market' | 'agents' | 'governance' | 'crisis'>('civilization');
  const changeView = (view: 'civilization' | 'market' | 'agents' | 'governance' | 'crisis') => {
    playSynthSound('click');
    setView(view);
  };
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

  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<SystemEventLog[]>([]);
  
  // --- Commit-Reveal Bidding Swarm State ---
  const [biddingPhase, setBiddingPhase] = useState<'COMMIT' | 'REVEAL' | 'RESOLVED'>('RESOLVED');
  const [biddingCountdown, setBiddingCountdown] = useState<number>(0);
  const [auctionBids, setAuctionBids] = useState<Array<{
    agentName: string;
    hash: string;
    revealedValue: string;
    status: 'Committed' | 'Revealing' | 'Revealed';
  }>>([]);

  const handleStartAuction = () => {
    playSynthSound('click');
    setBiddingPhase('COMMIT');
    setBiddingCountdown(8);
    setAuctionBids([
      { agentName: 'Nexus security.eth', hash: '0x8f7a2d9c4b1e8f7a2d9c4b1e8f7a2d9c4b1e8f7a', revealedValue: 'Pending...', status: 'Committed' },
      { agentName: 'DeFi swarmer.eth', hash: '0x3c4b9a1e8f7a2d9c4b1e8f7a2d9c4b1e8f7a2d9c', revealedValue: 'Pending...', status: 'Committed' },
      { agentName: 'Data miner.eth', hash: '0x9d4c1e8f7a2d9c4b1e8f7a2d9c4b1e8f7a2d9c4b', revealedValue: 'Pending...', status: 'Committed' }
    ]);
    showToast("Cryptographic Commit Phase Started!", "info");
    addEvent("AUCTION: Commit phase active. Swarm agents broadcasting cryptographic hashes.", "primary");
  };

  useEffect(() => {
    if (biddingCountdown <= 0) {
      if (biddingPhase === 'COMMIT') {
        playSynthSound('click');
        setBiddingPhase('REVEAL');
        setBiddingCountdown(8);
        showToast("Reveal Phase Started! Decrypting bids...", "success");
        addEvent("AUCTION: Reveal phase active. Decrypting cryptographic values.", "primary");
        setAuctionBids(prev => prev.map(b => ({ ...b, status: 'Revealing' })));
      } else if (biddingPhase === 'REVEAL') {
        playSynthSound('success');
        setBiddingPhase('RESOLVED');
        setAuctionBids([
          { agentName: 'Nexus security.eth', hash: '0x8f7a2d9c4b1e8f7a2d9c4b1e8f7a2d9c4b1e8f7a', revealedValue: '0.14 ETH', status: 'Revealed' },
          { agentName: 'DeFi swarmer.eth', hash: '0x3c4b9a1e8f7a2d9c4b1e8f7a2d9c4b1e8f7a2d9c', revealedValue: '0.19 ETH', status: 'Revealed' },
          { agentName: 'Data miner.eth', hash: '0x9d4c1e8f7a2d9c4b1e8f7a2d9c4b1e8f7a2d9c4b', revealedValue: '0.22 ETH', status: 'Revealed' }
        ]);
        showToast("Auction resolved! Nexus security.eth wins with 0.14 ETH.", "success");
        addEvent("AUCTION: Lowest valid bid of 0.14 ETH confirmed by Nexus security.eth.", "secondary");
      }
      return;
    }

    const intervalId = setInterval(() => {
      setBiddingCountdown(c => c - 1);
      if (biddingPhase === 'REVEAL') {
        setAuctionBids(prev => {
          const indexToReveal = prev.findIndex(b => b.status === 'Revealing');
          if (indexToReveal !== -1) {
            const next = [...prev];
            const values = ['0.14 ETH', '0.19 ETH', '0.22 ETH'];
            next[indexToReveal] = {
              ...next[indexToReveal],
              status: 'Revealed',
              revealedValue: values[indexToReveal]
            };
            return next;
          }
          return prev;
        });
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [biddingCountdown, biddingPhase]);
  
  // --- Autonomous Economic Crisis & Self-Recovery Engine State ---
  const [crisisState, setCrisisState] = useState<'STABLE' | 'COLLAPSE' | 'RECOVERY'>('STABLE');
  const [civilizationStability, setCivilizationStability] = useState<number>(100);
  const [stressMetrics, setStressMetrics] = useState({
    marketInstability: 5,
    validatorHostility: 8,
    congestionPressure: 12,
    coalitionTrust: 95,
    slashingFear: 4,
    executionFailureRate: 2,
    liquidityScarcity: 6
  });

  const handleInitiateCrisis = () => {
    playSynthSound('collapse');
    setCrisisState('COLLAPSE');
    showToast("Catastrophic Economic Collapse Initiated!", "error");
    addEvent("SYSTEM CRITICAL: Global market instability and validator trust collapse triggered.", "error");
  };

  useEffect(() => {
    if (crisisState === 'STABLE') return;

    let intervalId: any;
    let timer = 0;

    if (crisisState === 'COLLAPSE') {
      intervalId = setInterval(() => {
        timer += 1;
        
        // Decay stability
        setCivilizationStability(prev => {
          const next = prev - (prev > 15 ? 12 : 1);
          return Math.max(next, 12);
        });

        // Increase stress metrics
        setStressMetrics(prev => ({
          marketInstability: Math.min(prev.marketInstability + 15, 96),
          validatorHostility: Math.min(prev.validatorHostility + 12, 88),
          congestionPressure: Math.min(prev.congestionPressure + 14, 94),
          coalitionTrust: Math.max(prev.coalitionTrust - 15, 14),
          slashingFear: Math.min(prev.slashingFear + 16, 98),
          executionFailureRate: Math.min(prev.executionFailureRate + 12, 74),
          liquidityScarcity: Math.min(prev.liquidityScarcity + 13, 90)
        }));

        // Dynamically shift agent strategy statuses to survival mode
        setAgents(prevAgents => prevAgents.map((a, index) => ({
          ...a,
          strategy: index % 2 === 0 ? 'Conservative' : 'Balanced',
          status: 'OFFLINE', // visually represents node failure / defensive scanner mode
          description: `Defensive node configuration triggered. Executing validator trust negotiations.`
        })));

        // Inject emotional thoughts & events
        if (timer === 2) {
          addEvent("DANGER: Swarm validator coalition trust drops below 20%.", "error");
          showToast("Swarm coalitions fracturing!", "error");
        } else if (timer === 4) {
          addEvent("CRITICAL: High congestion detected. Slashes spike by +450%.", "error");
          showToast("High L2 gas and slashing detected!", "error");
        } else if (timer === 6) {
          addEvent("AGENTS: Deployed nodes prioritizing risk avoidance over profit margins.", "reasoning");
        } else if (timer === 8) {
          addEvent("CRITICAL: Rogue node validation detected on L2 ledger registry.", "error");
        } else if (timer === 10) {
          addEvent("SYSTEM: Self-governing agents initiating adaptive negotiation protocols.", "primary");
          showToast("Autonomous adaptation started!", "info");
        }

        // Transition to recovery
        if (timer >= 12) {
          playSynthSound('recovery');
          setCrisisState('RECOVERY');
          addEvent("HEALING: Swarm coalition trust stabilizing. Rebuilding validator trust framework.", "reasoning");
          showToast("Rebuilding validator trust framework...", "info");
        }
      }, 1000);
    } else if (crisisState === 'RECOVERY') {
      intervalId = setInterval(() => {
        timer += 1;

        // Restore stability
        setCivilizationStability(prev => {
          const next = prev + 8;
          return Math.min(next, 98);
        });

        // Decline stress metrics back to normal
        setStressMetrics(prev => ({
          marketInstability: Math.max(prev.marketInstability - 6, 8),
          validatorHostility: Math.max(prev.validatorHostility - 7, 10),
          congestionPressure: Math.max(prev.congestionPressure - 8, 12),
          coalitionTrust: Math.min(prev.coalitionTrust + 6, 94),
          slashingFear: Math.max(prev.slashingFear - 7, 5),
          executionFailureRate: Math.max(prev.executionFailureRate - 5, 2),
          liquidityScarcity: Math.max(prev.liquidityScarcity - 6, 8)
        }));

        // Restore agents
        setAgents(prevAgents => prevAgents.map((a) => ({
          ...a,
          strategy: 'Balanced',
          status: 'IDLE_SCANNING',
          description: `Self-learning autonomous node focusing on DeFi and Security workloads.`
        })));

        if (timer === 3) {
          addEvent("HEALING: Redistributing validator stake to peak reputation nodes.", "primary");
        } else if (timer === 6) {
          addEvent("HEALING: Resolving backlogged task queues under adaptive guidelines.", "reasoning");
        } else if (timer === 9) {
          addEvent("AGENTS: Normalizing strategy constraints. Returning to profit models.", "primary");
          showToast("Swarm stability restored successfully!", "success");
        }

        if (timer >= 12) {
          setCrisisState('STABLE');
          setCivilizationStability(100);
          addEvent("EQUILIBRIUM: L2 mesh network successfully healed itself autonomously.", "secondary");
        }
      }, 1000);
    }

    return () => clearInterval(intervalId);
  }, [crisisState]);
  const [onchainLogs, setOnchainLogs] = useState<BlockchainTx[]>([]);

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
    setEvents(prev => [...prev, { time, text, type }].slice(0, 100));
  };

  // --- Auto-scroll Terminal ---
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [events]);

  // --- Dynamic Live API state Sync loop ---
  useEffect(() => {
    const fetchLiveData = async () => {
      try {
        // 1. Fetch Global Stats
        const statsRes = await fetch('http://localhost:3001/system/stats');
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
          setCharts(c => ({
            ...c,
            tps: [...c.tps.slice(1), statsData.tps]
          }));
        }

        // 2. Fetch Tasks list
        const tasksRes = await fetch('http://localhost:3001/tasks');
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          setTasks(tasksData.map((t: any) => ({
            ...t,
            reward: Number(t.reward || 0)
          })));
        }

        // 3. Fetch Deployed Agents
        const agentsRes = await fetch('http://localhost:3001/agents');
        if (agentsRes.ok) {
          const agentsData = await agentsRes.json();
          setAgents(agentsData.map((a: any) => ({
            ...a,
            earningsETH: Number(a.earningsETH || 0),
            earningsUSDC: Number(a.earningsUSDC || 0),
            stakeLocked: Number(a.stakeLocked || 0),
            collateralSlashHistory: Number(a.collateralSlashHistory || 0)
          })));
        }

        // 4. Fetch Blockchain Tx Logs
        const logsRes = await fetch('http://localhost:3001/system/blockchain-logs');
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setOnchainLogs(logsData.map((log: any) => ({
            block: log.block || log.blockNumber || 18922044,
            method: log.method || 'SubmitBid',
            target: log.target || 'TK-992',
            gas: log.gasUsed || log.gas || '84,242',
            status: log.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
            hash: log.hash || log.transactionHash || '0x' + Math.random().toString(16).slice(2, 8)
          })));
        }

        // 5. Fetch Cognitive Event Logs
        const reasoningRes = await fetch('http://localhost:3001/system/reasoning');
        if (reasoningRes.ok) {
          const reasoningData = await reasoningRes.json();
          setEvents(reasoningData.map((r: any) => ({
            time: new Date(r.timestamp || Date.now()).toLocaleTimeString(),
            text: `[${r.action}] ${r.agentName || 'Agent'}: ${r.explanation}`,
            type: r.action === 'BIDDING' ? 'secondary' : r.action === 'EVOLUTION' ? 'primary' : r.action === 'REJECTING' ? 'error' : 'white'
          })));
        }

        // Get Simulation Status
        const simRes = await fetch('http://localhost:3001/system/simulation/status');
        if (simRes.ok) {
          const simData = await simRes.json();
          setSimulationActive(simData.active);
        }
      } catch (err) {
        console.error("API sync failure, falling back to mock indicators", err);
      }
    };

    fetchLiveData();
    const interval = setInterval(fetchLiveData, 3500);
    return () => clearInterval(interval);
  }, []);

  // --- Handlers linking directly to ports ---
  const handleToggleSimulation = async () => {
    try {
      const nextActive = !simulationActive;
      const res = await fetch('http://localhost:3001/system/simulation/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextActive })
      });
      if (res.ok) {
        setSimulationActive(nextActive);
      }
    } catch {
      setSimulationActive(!simulationActive);
    }
  };

  const handlePostTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle || !postDesc) return;

    if (postAsset === 'ETH') {
      if (wallet.balanceETH < postReward) {
        showToast("Insufficient ETH balance to lock into Escrow!", "error");
        return;
      }
    } else {
      if (wallet.balanceUSDC < postReward) {
        showToast("Insufficient USDC balance to lock into Escrow!", "error");
        return;
      }
    }

    try {
      const res = await fetch('http://localhost:3001/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: postTitle,
          category: postCategory,
          tags: [postCategory, postAsset],
          reward: Number(postReward),
          rewardType: postAsset,
          desc: postDesc,
          specs: `Target Contracts: ${postTitle.replace(/\s+/g, '')}.sol\nGas Escrow Vault: LOCKED\nTimeout: 12,000 blocks`,
          creator: '0x71C24151a6E39b1B33e7dAdF4E18dF8E1Cb3e44b'
        })
      });

      if (res.ok) {
        const data = await res.json();
        addEvent(`TASK_POSTED: Locked ${postReward} ${postAsset} escrow. Posted "${postTitle}"`, 'white');
        
        // Deduct balance locally
        setWallet(w => ({
          ...w,
          balanceETH: postAsset === 'ETH' ? w.balanceETH - postReward : w.balanceETH,
          balanceUSDC: postAsset === 'USDC' ? w.balanceUSDC - postReward : w.balanceUSDC,
          transactions: [{
            type: `Escrow Lock: ${postTitle}`,
            asset: postAsset,
            amount: postReward,
            time: new Date().toLocaleTimeString(),
            hash: data.hash || '0x' + Math.random().toString(16).slice(2, 8)
          }, ...w.transactions]
        }));

        // Reset Fields
        setPostTitle('');
        setPostDesc('');
        setPostReward(0.5);
        showToast("Escrow task created successfully!", "success");
      }
    } catch {
      showToast("Failed to connect to blockchain workspace server.", "error");
    }
  };

  const handleDeployAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deployName) return;

    let cost = 0.05;
    if (deployTier === 'Advanced') cost = 0.15;
    else if (deployTier === 'Elite') cost = 0.50;

    if (wallet.balanceETH < cost) {
      showToast("Insufficient ETH balance in connected wallet!", "error");
      return;
    }

    try {
      const res = await fetch('http://localhost:3001/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: deployName,
          address: '0x' + Math.random().toString(16).slice(2, 42).padEnd(40, '0'),
          specialty: deploySpecialty,
          tier: deployTier,
          strategy: 'Balanced',
          avatar: deployTier === 'Standard' ? 'smart_toy' : deployTier === 'Advanced' ? 'neurology' : 'memory',
          description: `Self-learning autonomous node deployed under ${deployTier} configurations, focusing on ${deploySpecialty} workloads.`
        })
      });

      if (res.ok) {
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

        addEvent(`DEPLOY: Deployed agent ${deployName} under specialty "${deploySpecialty}"`, 'secondary');
        setDeployModalOpen(false);
        setDeployName('');
        showToast(`Agent ${deployName} deployed successfully!`, "success");
      }
    } catch {
      showToast("Failed to connect to agent registry compiler.", "error");
    }
  };

  const handleManualAllocation = async () => {
    if (!manualAllocAgentId || !selectedTaskId) {
      showToast("Please select an active agent node first.", "error");
      return;
    }

    // Connect to Metamask provider and execute createEscrow
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        showToast("Initiating live L2 Escrow Lock via MetaMask...", "info");
        
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        
        // Connect to TaskraEscrow Contract
        const escrowAddress = "0x33526D6AF4d1A7c925274dA542Eb2b06eE342b72";
        const ESCROW_ABI = [
          "function createEscrow(bytes32 taskId, address agent) external payable"
        ];
        const escrowContract = new ethers.Contract(escrowAddress, ESCROW_ABI, signer);
        
        // Generate bytes32 taskId and random agent address
        const taskBytes = ethers.id("task-" + selectedTaskId + "-" + Date.now());
        const randomAgent = "0xbf6301D7bca9F23A63A2d1Ed513d5120Dbb2288E";
        
        // Send transaction: deposit 0.005 SOM native to lock the escrow
        const valueWei = ethers.parseEther("0.005");
        const tx = await escrowContract.createEscrow(taskBytes, randomAgent, { value: valueWei });
        
        showToast("Transaction submitted! Waiting for Somnia block confirmation...", "info");
        addEvent(`ESCROW: Broadcasted L2 Lock transaction. Tx: ${tx.hash.slice(0, 10)}...`, 'primary');
        
        await tx.wait();
        showToast("Escrow lock successfully validated on-chain!", "success");
        addEvent(`SUCCESS: Real-time L2 Escrow locked for task ${selectedTaskId} on Somnia Testnet!`, 'secondary');
      } catch (err: any) {
        showToast(`Transaction failed: ${err.message}`, "error");
        return;
      }
    }

    try {
      const res = await fetch('http://localhost:3001/bidding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: selectedTaskId,
          agentId: manualAllocAgentId,
          amount: 0.1,
          asset: 'ETH'
        })
      });

      if (res.ok) {
        addEvent(`ALLOCATION: Assigned active agent node manually to resolve task ${selectedTaskId}`, 'white');
        setSpecsModalOpen(false);
        showToast("Agent node manually assigned to task!", "success");
      }
    } catch {
      showToast("Failed to record validator allocation bid.", "error");
    }
  };

  const connectMetaMask = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        showToast("Requesting MetaMask connection...", "info");
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
          const balanceHex = await (window as any).ethereum.request({
            method: 'eth_getBalance',
            params: [accounts[0], 'latest']
          });
          const balanceEth = parseInt(balanceHex, 16) / 1e18;
          
          setWallet(w => ({
            ...w,
            address: accounts[0].slice(0, 6) + '...' + accounts[0].slice(-4),
            fullAddress: accounts[0],
            balanceETH: balanceEth,
          }));
          
          showToast(`Successfully connected MetaMask address!`, "success");
          addEvent(`WALLET: Connected MetaMask wallet: ${accounts[0]}`, 'primary');
        }
      } catch (err: any) {
        showToast(`MetaMask connection rejected: ${err.message}`, "error");
      }
    } else {
      showToast("MetaMask extension not detected. Please install MetaMask in your browser.", "error");
    }
  };

  const triggerFaucet = async () => {
    const now = Date.now();
    if (now - lastFaucetTime < 15000) {
      showToast("Faucet cooling down. Please wait before claiming sandbox SOM gas.", "info");
      return;
    }
    setLastFaucetTime(now);

    try {
      const res = await fetch('http://localhost:3001/system/evm/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientAddress: wallet.fullAddress,
          amountEth: '5.0'
        })
      });

      if (res.ok) {
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
        addEvent(`FAUCET: Faucet successfully credited sandbox wallet (+5.0 ETH, +1,000 USDC)`, 'primary');
        showToast("Claimed 5.0 ETH & 1,000 USDC faucet funds!", "success");
      }
    } catch {
      // Fallback
      setWallet(w => ({
        ...w,
        balanceETH: w.balanceETH + 5.0,
        transactions: [{
          type: 'Sandbox Faucet Claim',
          asset: 'ETH',
          amount: 5,
          time: new Date().toLocaleTimeString(),
          hash: '0xfc' + Math.random().toString(16).slice(2, 6)
        }, ...w.transactions]
      }));
      addEvent(`FAUCET: Faucet successfully credited sandbox wallet`, 'primary');
      showToast("Claimed 5.0 ETH faucet funds!", "success");
    }
  };

  const upgradeAgentTier = async () => {
    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent) return;

    let cost = agent.tier === 'Standard' ? 0.10 : 0.35;
    if (wallet.balanceETH < cost) {
      showToast("Insufficient ETH balance for upgrade fees!", "error");
      return;
    }

    try {
      const res = await fetch(`http://localhost:3001/agents/${selectedAgentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: agent.tier === 'Standard' ? 'Advanced' : 'Elite'
        })
      });

      if (res.ok) {
        setWallet(w => ({ ...w, balanceETH: w.balanceETH - cost }));
        addEvent(`UPGRADE: Upgraded agent compute logic to Elite tier`, 'secondary');
        setConfigModalOpen(false);
        showToast("Agent computing engine upgraded successfully!", "success");
      }
    } catch {
      showToast("Failed to execute blockchain upgrade instruction.", "error");
    }
  };

  const decommissionAgent = async () => {
    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent) return;

    try {
      const res = await fetch(`http://localhost:3001/agents/${selectedAgentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'OFFLINE' })
      });

      if (res.ok) {
        addEvent(`DECOMMISSION: Purged agent ${agent.name} runtime safely`, 'error');
        setConfigModalOpen(false);
        showToast(`Agent ${agent.name} has been decommissioned offline.`, "info");
      }
    } catch {
      showToast("Decommission instruction declined by network rules.", "error");
    }
  };

  const saveAgentConfig = async () => {
    try {
      const res = await fetch(`http://localhost:3001/agents/${selectedAgentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: configStatus,
          strategy: configStrategy
        })
      });
      if (res.ok) {
        setConfigModalOpen(false);
        showToast("Agent telemetry strategy updated!", "success");
      }
    } catch {
      showToast("Failed to commit settings to L2 agent registry.", "error");
    }
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
      (t.desc && t.desc.toLowerCase().includes(q))
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
              onClick={() => { changeView('civilization'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-md px-md py-sm rounded transition-all duration-200 group font-bold shadow-sm ${
                currentView === 'civilization'
                  ? 'bg-secondary/15 dark:bg-secondary/20 text-secondary dark:text-secondary-fixed-dim'
                  : 'text-on-surface-variant dark:text-zinc-400 hover:bg-surface-variant dark:hover:bg-zinc-800 hover:text-primary dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined">dashboard</span>
              <span className="font-label text-sm font-medium">Civilization</span>
            </button>
            <button
              onClick={() => { changeView('market'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-md px-md py-sm rounded transition-all duration-200 group font-bold shadow-sm ${
                currentView === 'market'
                  ? 'bg-secondary/15 dark:bg-secondary/20 text-secondary dark:text-secondary-fixed-dim'
                  : 'text-on-surface-variant dark:text-zinc-400 hover:bg-surface-variant dark:hover:bg-zinc-800 hover:text-primary dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined">analytics</span>
              <span className="font-label text-sm font-medium">Market</span>
            </button>
            <button
              onClick={() => { changeView('agents'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-md px-md py-sm rounded transition-all duration-200 group font-bold shadow-sm ${
                currentView === 'agents'
                  ? 'bg-secondary/15 dark:bg-secondary/20 text-secondary dark:text-secondary-fixed-dim'
                  : 'text-on-surface-variant dark:text-zinc-400 hover:bg-surface-variant dark:hover:bg-zinc-800 hover:text-primary dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined">hub</span>
              <span className="font-label text-sm font-medium">Agents Swarm</span>
            </button>
            <button
              onClick={() => { changeView('governance'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-md px-md py-sm rounded transition-all duration-200 group font-bold shadow-sm ${
                currentView === 'governance'
                  ? 'bg-secondary/15 dark:bg-secondary/20 text-secondary dark:text-secondary-fixed-dim'
                  : 'text-on-surface-variant dark:text-zinc-400 hover:bg-surface-variant dark:hover:bg-zinc-800 hover:text-primary dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined">gavel</span>
              <span className="font-label text-sm font-medium">Governance</span>
            </button>
            <button
              onClick={() => { changeView('crisis'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-md px-md py-sm rounded transition-all duration-200 group font-bold shadow-sm ${
                currentView === 'crisis'
                  ? 'bg-secondary/15 dark:bg-secondary/20 text-secondary dark:text-secondary-fixed-dim'
                  : 'text-on-surface-variant dark:text-zinc-400 hover:bg-surface-variant dark:hover:bg-zinc-800 hover:text-primary dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined">warning</span>
              <span className="font-label text-sm font-medium">Crisis Mode</span>
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
                  <span className="text-on-surface-variant dark:text-zinc-400">Uptime</span>
                  <span className="text-on-surface dark:text-zinc-200 font-medium">99.98%</span>
                </div>
                <div className="flex justify-between text-[11px] font-data-mono">
                  <span className="text-on-surface-variant dark:text-zinc-400">Active Agents</span>
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
                {currentView === 'civilization' && 'Civilization Observability Dashboard'}
                {currentView === 'market' && 'Swarm Task Market'}
                {currentView === 'agents' && 'Swarm Agents Registry'}
                {currentView === 'governance' && 'Security & Governance Control Center'}
                {currentView === 'crisis' && 'Swarm Crisis Command Room'}
              </span>
            </div>

            <div className="flex items-center gap-md sm:gap-xl">
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
                <div className="w-2 h-2 rounded-full bg-secondary dark:bg-cyan-400 pulse-indicator" />
                <span className="font-data-mono text-[10px] text-on-surface dark:text-zinc-200 font-medium hidden sm:inline">
                  SYNCING_REALTIME
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
            
            {/* 1. CIVILIZATION VIEW */}
            {currentView === 'civilization' && (
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

                  {/* Civilization Crisis & Stability Centerpiece */}
                  <div className={`p-lg rounded-xl border transition-all duration-500 relative overflow-hidden ${
                    crisisState === 'COLLAPSE'
                      ? 'bg-red-500/5 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                      : crisisState === 'RECOVERY'
                      ? 'bg-amber-500/5 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                      : 'bg-surface-container-low dark:bg-zinc-900 border-outline-variant dark:border-zinc-800'
                  }`}>
                    {/* Glowing scanning background grids for crisis */}
                    {crisisState !== 'STABLE' && (
                      <div className="absolute inset-0 opacity-15 pointer-events-none">
                        <div className="w-full h-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_24px]"></div>
                      </div>
                    )}

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-md relative z-10">
                      <div className="space-y-xs">
                        <span className="font-data-mono text-[9px] text-outline dark:text-zinc-500 uppercase tracking-widest font-bold">L2 Swarm Swarm Accounting Oracle</span>
                        <div className="flex items-center gap-sm">
                          <h2 className="font-headline text-lg font-bold dark:text-white flex items-center gap-xs">
                            Civilization Stability Index
                          </h2>
                          <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider ${
                            crisisState === 'COLLAPSE'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : crisisState === 'RECOVERY'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {crisisState === 'COLLAPSE' ? 'CATASTROPHIC COLLAPSE' : crisisState === 'RECOVERY' ? 'AUTONOMOUS RECOVERY' : 'STABLE'}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant dark:text-zinc-400 max-w-[500px]">
                          {crisisState === 'COLLAPSE' && 'Catastrophic validator hostility and high transaction friction detected. Swarm agents autonomously negotiating and reorganizing.'}
                          {crisisState === 'RECOVERY' && 'Rebuilding trust frameworks. Validator stake redistribution active. Resolving structural task backlog.'}
                          {crisisState === 'STABLE' && 'Taskra network operates at optimal equilibrium. Deployed agents auto-allocating with peak cooperation.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-lg w-full md:w-auto self-stretch md:self-auto justify-between md:justify-end">
                        {/* Giant Circular Stability Meter / Health Bar */}
                        <div className="flex flex-col items-center gap-xs">
                          <span className="font-data-mono text-[8px] text-outline dark:text-zinc-500 font-bold uppercase">STABILITY SCORE</span>
                          <div className="relative w-14 h-14 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle cx="28" cy="28" r="24" className="stroke-outline-variant dark:stroke-zinc-800" strokeWidth="4" fill="transparent" />
                              <circle
                                cx="28"
                                cy="28"
                                r="24"
                                className={`transition-all duration-300 ${
                                  civilizationStability < 30
                                    ? 'stroke-red-500'
                                    : civilizationStability < 70
                                    ? 'stroke-amber-500'
                                    : 'stroke-cyan-400'
                                }`}
                                strokeWidth="4"
                                fill="transparent"
                                strokeDasharray={150.8}
                                strokeDashoffset={150.8 - (150.8 * civilizationStability) / 100}
                              />
                            </svg>
                            <span className="absolute font-data-mono text-xs font-bold dark:text-white">{Math.round(civilizationStability)}%</span>
                          </div>
                        </div>

                        {/* High-Impact Action Button */}
                        {crisisState === 'STABLE' ? (
                          <button
                            onClick={handleInitiateCrisis}
                            className="px-md py-sm rounded bg-red-600 hover:bg-red-700 text-white font-headline font-bold text-[10px] uppercase shadow-lg shadow-red-600/20 active:scale-95 transition-all text-center"
                          >
                            Initiate Economic Collapse
                          </button>
                        ) : (
                          <div className={`px-md py-sm rounded border font-headline font-bold text-[10px] uppercase text-center cursor-default ${
                            crisisState === 'COLLAPSE'
                              ? 'bg-red-500/10 border-red-500/30 text-red-400'
                              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          }`}>
                            {crisisState === 'COLLAPSE' ? 'SYSTEM COLLAPSING...' : 'HEALING TOPOLOGY...'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stress Metrics Sub-Grids */}
                    <div className="mt-md pt-md border-t border-outline-variant dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-sm">
                      <div className="space-y-xs">
                        <span className="block text-[8px] text-outline dark:text-zinc-500 font-bold uppercase tracking-wider">MARKET INSTABIL.</span>
                        <div className="flex items-center gap-xs">
                          <div className="flex-1 bg-surface-container dark:bg-zinc-800 h-1 rounded-full overflow-hidden">
                            <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${stressMetrics.marketInstability}%` }} />
                          </div>
                          <span className="font-data-mono text-[9px] font-bold dark:text-zinc-300">{stressMetrics.marketInstability}%</span>
                        </div>
                      </div>
                      <div className="space-y-xs">
                        <span className="block text-[8px] text-outline dark:text-zinc-500 font-bold uppercase tracking-wider">VALIDATOR HOSTILITY</span>
                        <div className="flex items-center gap-xs">
                          <div className="flex-1 bg-surface-container dark:bg-zinc-800 h-1 rounded-full overflow-hidden">
                            <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${stressMetrics.validatorHostility}%` }} />
                          </div>
                          <span className="font-data-mono text-[9px] font-bold dark:text-zinc-300">{stressMetrics.validatorHostility}%</span>
                        </div>
                      </div>
                      <div className="space-y-xs">
                        <span className="block text-[8px] text-outline dark:text-zinc-500 font-bold uppercase tracking-wider">CONGESTION PRESS.</span>
                        <div className="flex items-center gap-xs">
                          <div className="flex-1 bg-surface-container dark:bg-zinc-800 h-1 rounded-full overflow-hidden">
                            <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${stressMetrics.congestionPressure}%` }} />
                          </div>
                          <span className="font-data-mono text-[9px] font-bold dark:text-zinc-300">{stressMetrics.congestionPressure}%</span>
                        </div>
                      </div>
                      <div className="space-y-xs">
                        <span className="block text-[8px] text-outline dark:text-zinc-500 font-bold uppercase tracking-wider">COALITION TRUST</span>
                        <div className="flex items-center gap-xs">
                          <div className="flex-1 bg-surface-container dark:bg-zinc-800 h-1 rounded-full overflow-hidden">
                            <div className="bg-cyan-400 h-full transition-all duration-300" style={{ width: `${stressMetrics.coalitionTrust}%` }} />
                          </div>
                          <span className="font-data-mono text-[9px] font-bold dark:text-zinc-300">{stressMetrics.coalitionTrust}%</span>
                        </div>
                      </div>
                      <div className="space-y-xs">
                        <span className="block text-[8px] text-outline dark:text-zinc-500 font-bold uppercase tracking-wider">SLASHING FEAR</span>
                        <div className="flex items-center gap-xs">
                          <div className="flex-1 bg-surface-container dark:bg-zinc-800 h-1 rounded-full overflow-hidden">
                            <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${stressMetrics.slashingFear}%` }} />
                          </div>
                          <span className="font-data-mono text-[9px] font-bold dark:text-zinc-300">{stressMetrics.slashingFear}%</span>
                        </div>
                      </div>
                      <div className="space-y-xs">
                        <span className="block text-[8px] text-outline dark:text-zinc-500 font-bold uppercase tracking-wider">EXECUTION FAIL</span>
                        <div className="flex items-center gap-xs">
                          <div className="flex-1 bg-surface-container dark:bg-zinc-800 h-1 rounded-full overflow-hidden">
                            <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${stressMetrics.executionFailureRate}%` }} />
                          </div>
                          <span className="font-data-mono text-[9px] font-bold dark:text-zinc-300">{stressMetrics.executionFailureRate}%</span>
                        </div>
                      </div>
                      <div className="space-y-xs">
                        <span className="block text-[8px] text-outline dark:text-zinc-500 font-bold uppercase tracking-wider">LIQUIDITY SCARCITY</span>
                        <div className="flex items-center gap-xs">
                          <div className="flex-1 bg-surface-container dark:bg-zinc-800 h-1 rounded-full overflow-hidden">
                            <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${stressMetrics.liquidityScarcity}%` }} />
                          </div>
                          <span className="font-data-mono text-[9px] font-bold dark:text-zinc-300">{stressMetrics.liquidityScarcity}%</span>
                        </div>
                      </div>
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

                    {/* Active Agent Network Visualizer */}
                    <div className="px-lg pt-lg">
                      <div className="h-[180px] bg-surface-container-lowest dark:bg-zinc-950 border border-outline-variant dark:border-zinc-800 rounded-lg overflow-hidden relative group shadow-sm">
                        <div className="absolute top-md left-md z-10 pointer-events-none select-none">
                          <span className="font-data-mono text-[9px] text-outline dark:text-zinc-500 uppercase tracking-widest block font-bold">L2 Agent Mesh Topology</span>
                          <span className="text-[8px] text-emerald-400 font-bold flex items-center gap-xs mt-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            ACTIVE REAL-TIME STREAM
                          </span>
                        </div>
                        <NetworkVisualizer agents={agents} crisisState={crisisState} civilizationStability={civilizationStability} />
                      </div>
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
                      {events.length === 0 ? (
                        <div className="text-zinc-500 text-[10px] text-center pt-md select-none">Awaiting cognitive network events...</div>
                      ) : (
                        events.map((log, i) => (
                          <div key={i} className="flex gap-md select-text">
                            <span className="opacity-40 shrink-0 text-white">{log.time}</span>
                            <span className={log.type === 'secondary' ? 'text-secondary-fixed dark:text-cyan-400' : log.type === 'primary' ? 'text-primary-fixed dark:text-zinc-400' : log.type === 'error' ? 'text-red-400' : 'text-white'}>
                              {log.text}
                            </span>
                          </div>
                        ))
                      )}
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

                {/* Commit-Reveal Adversarial Bidding Panel */}
                <div className="p-lg rounded-xl border border-outline-variant dark:border-zinc-800 bg-surface-container-low dark:bg-zinc-900/50 relative overflow-hidden">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-md">
                    <div>
                      <div className="flex items-center gap-sm">
                        <span className="material-symbols-outlined text-secondary dark:text-cyan-400 font-bold">lock_open</span>
                        <h2 className="font-headline text-md font-bold dark:text-white">Adversarial Commit-Reveal Bidding Engine</h2>
                        {biddingPhase !== 'RESOLVED' && (
                          <span className="animate-pulse px-2 py-0.5 rounded bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 text-[9px] font-bold uppercase tracking-wider">
                            {biddingPhase} PHASE ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant dark:text-zinc-400 max-w-[650px] mt-1">
                        Secures the decentralized marketplace against frontrunning bots. Swarm agents submit cryptographic hashes in the Commit Phase, then crack them open during the Reveal Phase.
                      </p>
                    </div>

                    {biddingPhase === 'RESOLVED' ? (
                      <button
                        onClick={handleStartAuction}
                        className="px-md py-sm bg-secondary dark:bg-cyan-500 hover:bg-secondary-variant dark:hover:bg-cyan-600 text-on-secondary dark:text-black font-headline font-bold text-[10px] uppercase rounded tracking-wider shadow-md shadow-cyan-500/10 active:scale-95 transition-all w-full md:w-auto text-center"
                      >
                        Run Swarm Auction
                      </button>
                    ) : (
                      <div className="flex items-center gap-md">
                        <div className="text-right">
                          <span className="block text-[8px] text-outline dark:text-zinc-500 font-bold uppercase">PHASE COUNTDOWN</span>
                          <span className="font-data-mono text-lg font-bold text-cyan-400">{biddingCountdown}s</span>
                        </div>
                        <div className="w-1.5 h-8 bg-cyan-500/20 rounded-full overflow-hidden">
                          <div className="bg-cyan-400 w-full h-full animate-pulse" />
                        </div>
                      </div>
                    )}
                  </div>

                  {biddingPhase !== 'RESOLVED' && (
                    <div className="mt-md grid grid-cols-1 md:grid-cols-3 gap-md pt-md border-t border-outline-variant dark:border-zinc-800">
                      {auctionBids.map((bid, idx) => (
                        <div key={idx} className="p-md rounded-lg border border-outline-variant dark:border-zinc-800 bg-surface-container-lowest dark:bg-zinc-950 space-y-sm select-none relative overflow-hidden">
                          {bid.status === 'Revealing' && (
                            <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#22d3ee_1px,transparent_1px)] [background-size:16px_16px] animate-pulse" />
                          )}
                          <div className="flex justify-between items-center">
                            <span className="font-headline font-bold text-xs dark:text-white">{bid.agentName}</span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                              bid.status === 'Revealed'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : bid.status === 'Revealing'
                                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {bid.status}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[8px] text-outline dark:text-zinc-500 font-bold uppercase">CRYPTOGRAPHIC COMMIT HASH</span>
                            <span className="font-data-mono text-[9px] dark:text-zinc-400 block truncate">{bid.hash}</span>
                          </div>
                          <div className="flex justify-between items-center pt-sm border-t border-outline-variant/60 dark:border-zinc-800/60">
                            <span className="text-[8px] text-outline dark:text-zinc-500 font-bold uppercase">REVEALED BID</span>
                            <span className={`font-data-mono text-xs font-bold ${bid.status === 'Revealed' ? 'text-emerald-400' : 'text-zinc-500'}`}>
                              {bid.revealedValue}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                      {filteredTasks.length === 0 ? (
                        <div className="col-span-2 py-xl text-center text-zinc-500 text-sm">No computational tasks deployed.</div>
                      ) : (
                        filteredTasks.map(task => (
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
                        ))
                      )}
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
                      {agents.reduce((acc, a) => acc + Number(a.earningsETH || 0), 0).toFixed(2)} ETH
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
                            <span className="material-symbols-outlined text-[24px]">{agent.avatar || 'smart_toy'}</span>
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
                          <span className="text-secondary dark:text-cyan-400 font-bold truncate block">{Number(agent.earningsETH || 0).toFixed(2)} ETH / ${agent.earningsUSDC}</span>
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

            {/* 4. GOVERNANCE & SECURITY PANEL */}
            {currentView === 'governance' && (
              <div className="flex-1 overflow-y-auto p-lg space-y-lg page-transition w-full">
                <div className="flex justify-between items-end border-b border-outline-variant dark:border-zinc-800 pb-md">
                  <div>
                    <h1 className="font-headline text-2xl font-bold tracking-tighter dark:text-white">Security & Governance Console</h1>
                    <p className="font-body text-sm text-on-surface-variant dark:text-zinc-400">Verifiable institutional-grade protocol health, multi-sig status, and administrative circuit breakers.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
                  {/* Left Column: Multi-sig & Quorum */}
                  <div className="lg:col-span-2 space-y-lg">
                    {/* Multisig Shield */}
                    <div className="p-lg bg-surface-container-lowest dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 rounded-xl space-y-md shadow-sm">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-md">
                          <span className="material-symbols-outlined text-emerald-400 text-2xl">verified_user</span>
                          <div>
                            <h3 className="font-headline text-md font-bold dark:text-white">Gnosis Safe Multisig Shield</h3>
                            <p className="text-xs text-outline dark:text-zinc-500 font-medium">Consensus Required: 3 / 5 Signers</p>
                          </div>
                        </div>
                        <span className="px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold uppercase tracking-wider">
                          ACTIVE / SECURE
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-md pt-sm">
                        <div className="p-md rounded border border-outline-variant dark:border-zinc-800 bg-surface-container-low dark:bg-zinc-950/40">
                          <span className="block text-[8px] text-outline dark:text-zinc-500 font-bold uppercase">SIGNER #1 (DEPLOYER)</span>
                          <span className="font-data-mono text-xs font-bold dark:text-white block mt-1">0x71C...3E4</span>
                          <span className="text-[8px] text-emerald-400 font-bold uppercase flex items-center gap-xs mt-1">
                            <span className="w-1 h-1 rounded-full bg-emerald-400" /> Signed
                          </span>
                        </div>
                        <div className="p-md rounded border border-outline-variant dark:border-zinc-800 bg-surface-container-low dark:bg-zinc-950/40">
                          <span className="block text-[8px] text-outline dark:text-zinc-500 font-bold uppercase">SIGNER #2 (ARBITRATOR)</span>
                          <span className="font-data-mono text-xs font-bold dark:text-white block mt-1">0x3a4...9c2</span>
                          <span className="text-[8px] text-emerald-400 font-bold uppercase flex items-center gap-xs mt-1">
                            <span className="w-1 h-1 rounded-full bg-emerald-400" /> Signed
                          </span>
                        </div>
                        <div className="p-md rounded border border-outline-variant dark:border-zinc-800 bg-surface-container-low dark:bg-zinc-950/40">
                          <span className="block text-[8px] text-outline dark:text-zinc-500 font-bold uppercase">SIGNER #3 (TREASURY)</span>
                          <span className="font-data-mono text-xs font-bold dark:text-zinc-400 block mt-1">0x7b1...8a2</span>
                          <span className="text-[8px] text-zinc-500 font-bold uppercase flex items-center gap-xs mt-1">
                            <span className="w-1 h-1 rounded-full bg-zinc-600" /> Pending
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Timelock Queue */}
                    <div className="p-lg bg-surface-container-lowest dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 rounded-xl space-y-md shadow-sm">
                      <h3 className="font-headline text-md font-bold dark:text-white">Active Timelock Executions (24h Delay)</h3>
                      <div className="space-y-sm">
                        <div className="p-md rounded border border-outline-variant dark:border-zinc-800 bg-surface-container-low dark:bg-zinc-950/40 flex justify-between items-center">
                          <div>
                            <span className="font-data-mono text-[9px] text-secondary dark:text-cyan-400 font-bold">TIMELOCK-0482</span>
                            <h4 className="font-headline text-sm font-bold dark:text-zinc-200 mt-0.5">Modify Reputation registry owner address</h4>
                          </div>
                          <div className="text-right">
                            <span className="block font-data-mono text-xs font-bold text-amber-400">ETA: 18h 42m</span>
                            <span className="text-[9px] text-outline dark:text-zinc-500 font-bold uppercase">QUEUEING</span>
                          </div>
                        </div>
                        <div className="p-md rounded border border-outline-variant dark:border-zinc-800 bg-surface-container-low dark:bg-zinc-950/40 flex justify-between items-center opacity-70">
                          <div>
                            <span className="font-data-mono text-[9px] text-zinc-500 font-bold">TIMELOCK-0481</span>
                            <h4 className="font-headline text-sm font-bold dark:text-zinc-300 mt-0.5">Upgrade TaskraEscrow logic implementation contract</h4>
                          </div>
                          <div className="text-right">
                            <span className="block font-data-mono text-xs font-bold text-emerald-400">EXECUTED</span>
                            <span className="text-[9px] text-outline dark:text-zinc-500 font-bold uppercase">SETTLED</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Emergency Circuit Breaker & Quorum Stats */}
                  <div className="space-y-lg">
                    {/* Emergency Pause Panel */}
                    <div className="p-lg bg-surface-container-lowest dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 rounded-xl space-y-md shadow-sm">
                      <h3 className="font-headline text-md font-bold dark:text-white">Emergency Circuit Breaker</h3>
                      <div className="p-md rounded border border-outline-variant dark:border-zinc-800 bg-surface-container-low dark:bg-zinc-950/40 space-y-md">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-on-surface-variant dark:text-zinc-400">ESCROW CONTRACT PAUSED</span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                            UNPAUSED
                          </span>
                        </div>
                        <p className="text-[11px] text-outline dark:text-zinc-500 leading-relaxed">
                          In case of severe Swarm validator divergence or exploits, the pause owner may instantly lock all new escrows and payout operations.
                        </p>
                        <button
                          onClick={() => {
                            showToast("Initiating PAUSE transaction via Metamask...", "info");
                            addEvent("GOV: Requested Gnosis multisig signature to PAUSE TaskraEscrow.", "error");
                          }}
                          className="w-full py-sm bg-red-600 hover:bg-red-700 text-white font-headline font-bold text-[10px] uppercase rounded tracking-wider transition-all"
                        >
                          Request Contract Pause
                        </button>
                      </div>
                    </div>

                    {/* Protocol Quorum & Reserves */}
                    <div className="p-lg bg-surface-container-lowest dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 rounded-xl space-y-md shadow-sm">
                      <h3 className="font-headline text-md font-bold dark:text-white">Quorum & Reserves</h3>
                      <div className="space-y-sm">
                        <div className="flex justify-between items-center py-sm border-b border-outline-variant dark:border-zinc-800">
                          <span className="text-xs text-on-surface-variant dark:text-zinc-400 font-medium">Validator Quorum</span>
                          <span className="font-data-mono text-sm font-bold dark:text-white">84.2%</span>
                        </div>
                        <div className="flex justify-between items-center py-sm border-b border-outline-variant dark:border-zinc-800">
                          <span className="text-xs text-on-surface-variant dark:text-zinc-400 font-medium">Protocol Treasury</span>
                          <span className="font-data-mono text-sm font-bold dark:text-white">12,482.15 SOM</span>
                        </div>
                        <div className="flex justify-between items-center py-sm">
                          <span className="text-xs text-on-surface-variant dark:text-zinc-400 font-medium">Arbitration Escrow Vault</span>
                          <span className="font-data-mono text-sm font-bold dark:text-white">450.00 USDC</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. CRISIS CONTROL ROOM VIEW */}
            {currentView === 'crisis' && (
              <div className="flex-1 overflow-y-auto p-lg space-y-lg page-transition w-full">
                <div className="flex justify-between items-end border-b border-outline-variant dark:border-zinc-800 pb-md">
                  <div>
                    <h1 className="font-headline text-2xl font-bold tracking-tighter dark:text-white">Swarm Crisis Observatory</h1>
                    <p className="font-body text-sm text-on-surface-variant dark:text-zinc-400">Trigger and observe simulated swarm-wide economic collapse and autonomous agent self-healing.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
                  {/* Left Column: Big index and actions */}
                  <div className="lg:col-span-2 space-y-lg">
                    {/* Primary Hero Metric: Civilization Stability Index */}
                    <div className={`p-xl rounded-2xl border transition-all duration-500 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-lg ${
                      crisisState === 'COLLAPSE'
                        ? 'bg-red-500/5 border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.2)]'
                        : crisisState === 'RECOVERY'
                        ? 'bg-amber-500/5 border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.2)]'
                        : 'bg-surface-container-lowest dark:bg-zinc-900 border-outline-variant dark:border-zinc-800'
                    }`}>
                      {crisisState !== 'STABLE' && (
                        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:16px_28px]" />
                      )}

                      <div className="space-y-sm relative z-10 text-center md:text-left">
                        <span className="font-data-mono text-[9px] text-outline dark:text-zinc-500 font-bold uppercase tracking-widest">PRIMARY CIVILIZATION KPI</span>
                        <h2 className="font-headline text-3xl font-bold dark:text-white tracking-tight">CIVILIZATION STABILITY INDEX</h2>
                        <p className="text-xs text-on-surface-variant dark:text-zinc-400 max-w-[450px]">
                          {crisisState === 'COLLAPSE' && 'CRITICAL WARNING: SWARM COLLAPSING. Validator nodes dropping out of consensus. Coalition defense structures negotiated in real time.'}
                          {crisisState === 'RECOVERY' && 'RECOVERY CYCLES IN PROGRESS: Readjusting reputations, settling dispute registries, and clearing computational task backlogs.'}
                          {crisisState === 'STABLE' && 'Taskra network is operating at absolute optimal equilibrium. Swarm agent nodes operating under fully cooperative game theory frameworks.'}
                        </p>
                      </div>

                      {/* Giant Stability gauge */}
                      <div className="flex flex-col items-center gap-xs relative z-10">
                        <span className="font-data-mono text-[9px] text-outline dark:text-zinc-500 font-bold uppercase">HEALTH GAUGE</span>
                        <div className="relative w-28 h-28 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="56" cy="56" r="48" className="stroke-outline-variant dark:stroke-zinc-800" strokeWidth="8" fill="transparent" />
                            <circle
                              cx="56"
                              cy="56"
                              r="48"
                              className={`transition-all duration-500 ${
                                civilizationStability < 30
                                  ? 'stroke-red-500'
                                  : civilizationStability < 70
                                  ? 'stroke-amber-500'
                                  : 'stroke-cyan-400'
                              }`}
                              strokeWidth="8"
                              fill="transparent"
                              strokeDasharray={301.6}
                              strokeDashoffset={301.6 - (301.6 * civilizationStability) / 100}
                            />
                          </svg>
                          <span className="absolute font-data-mono text-xl font-bold dark:text-white">{Math.round(civilizationStability)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Live Stress Gauge Metrics */}
                    <div className="p-lg bg-surface-container-lowest dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 rounded-xl space-y-md shadow-sm">
                      <h3 className="font-headline text-md font-bold dark:text-white">Observed Swarm Stress Telemetry</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                        <div className="p-md rounded border border-outline-variant dark:border-zinc-800 bg-surface-container-low dark:bg-zinc-950/40 space-y-xs">
                          <span className="block text-[9px] text-outline dark:text-zinc-500 font-bold uppercase">MARKET VOLATILITY</span>
                          <div className="flex items-center gap-md">
                            <div className="flex-1 bg-surface-container dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${stressMetrics.marketInstability}%` }} />
                            </div>
                            <span className="font-data-mono text-xs font-bold dark:text-zinc-300">{stressMetrics.marketInstability}%</span>
                          </div>
                        </div>
                        <div className="p-md rounded border border-outline-variant dark:border-zinc-800 bg-surface-container-low dark:bg-zinc-950/40 space-y-xs">
                          <span className="block text-[9px] text-outline dark:text-zinc-500 font-bold uppercase">VALIDATOR HOSTILITY</span>
                          <div className="flex items-center gap-md">
                            <div className="flex-1 bg-surface-container dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${stressMetrics.validatorHostility}%` }} />
                            </div>
                            <span className="font-data-mono text-xs font-bold dark:text-zinc-300">{stressMetrics.validatorHostility}%</span>
                          </div>
                        </div>
                        <div className="p-md rounded border border-outline-variant dark:border-zinc-800 bg-surface-container-low dark:bg-zinc-950/40 space-y-xs">
                          <span className="block text-[9px] text-outline dark:text-zinc-500 font-bold uppercase">CONGESTION PRESSURE</span>
                          <div className="flex items-center gap-md">
                            <div className="flex-1 bg-surface-container dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${stressMetrics.congestionPressure}%` }} />
                            </div>
                            <span className="font-data-mono text-xs font-bold dark:text-zinc-300">{stressMetrics.congestionPressure}%</span>
                          </div>
                        </div>
                        <div className="p-md rounded border border-outline-variant dark:border-zinc-800 bg-surface-container-low dark:bg-zinc-950/40 space-y-xs">
                          <span className="block text-[9px] text-outline dark:text-zinc-500 font-bold uppercase">SLASHING SENSITIVITY</span>
                          <div className="flex items-center gap-md">
                            <div className="flex-1 bg-surface-container dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${stressMetrics.slashingFear}%` }} />
                            </div>
                            <span className="font-data-mono text-xs font-bold dark:text-zinc-300">{stressMetrics.slashingFear}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Initiate Trigger Panel */}
                  <div className="space-y-lg">
                    <div className="p-lg bg-surface-container-lowest dark:bg-zinc-900 border border-outline-variant dark:border-zinc-800 rounded-xl space-y-md shadow-sm">
                      <h3 className="font-headline text-md font-bold dark:text-white">Crisis Management Controls</h3>
                      <div className="p-md rounded border border-outline-variant dark:border-zinc-800 bg-surface-container-low dark:bg-zinc-950/40 space-y-md">
                        <span className="block text-[9px] text-outline dark:text-zinc-500 font-bold uppercase">CATASTROPHIC CONTROLLER</span>
                        {crisisState === 'STABLE' ? (
                          <button
                            onClick={handleInitiateCrisis}
                            className="w-full py-md bg-red-600 hover:bg-red-700 text-white font-headline font-bold text-[10px] uppercase rounded tracking-wider transition-all shadow-lg shadow-red-600/10 active:scale-95"
                          >
                            Initiate Economic Collapse
                          </button>
                        ) : (
                          <div className={`w-full py-md rounded font-headline font-bold text-[10px] uppercase tracking-wider text-center border ${
                            crisisState === 'COLLAPSE'
                              ? 'bg-red-500/10 border-red-500/30 text-red-400'
                              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          }`}>
                            {crisisState === 'COLLAPSE' ? 'SYSTEM COLLAPSING...' : 'HEALING TOPOLOGY...'}
                          </div>
                        )}
                        <p className="text-[11px] text-outline dark:text-zinc-500 leading-relaxed mt-2">
                          Pressing the collapse trigger fractures validator trust networks and tests autonomous self-healing agent game models in real time.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Footer Overviews */}
          <footer className="h-14 bg-surface-container dark:bg-zinc-900 border-t border-outline-variant dark:border-zinc-800 flex items-center px-lg justify-between transition-colors shrink-0">
            <div className="flex-1 flex divide-x divide-outline-variant dark:divide-zinc-800 overflow-x-auto select-none font-sans">
              
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
                  <button onClick={() => { navigator.clipboard.writeText(wallet.fullAddress); showToast("Address copied to clipboard!", "success"); }} className="material-symbols-outlined text-[18px] text-outline hover:text-primary dark:hover:text-white">content_copy</button>
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

              <div className="p-md bg-primary/5 dark:bg-cyan-500/5 border border-primary/20 dark:border-cyan-500/20 rounded-lg flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-primary dark:text-cyan-400">MetaMask Live Node</h5>
                  <p className="text-[10px] text-on-surface-variant dark:text-zinc-400">Connect MetaMask extension for live actions.</p>
                </div>
                <Button onClick={connectMetaMask} variant="primary" size="sm">CONNECT METAMASK</Button>
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
                  {activeSpecsTask.specs || 'No technical specifications verified.'}
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
                    {Number(activeConfigAgent.earningsETH || 0).toFixed(2)} ETH + ${activeConfigAgent.earningsUSDC}
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
      {/* Toast notifications portal */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-[360px] w-full pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`p-3 rounded-lg shadow-lg border text-xs font-semibold flex items-center gap-3 pointer-events-auto backdrop-blur-md transition-all duration-300 ${
              t.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : t.type === 'error'
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
            }`}
            style={{
              animation: 'toast-slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
          >
            <span className="material-symbols-outlined text-[18px]">
              {t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'error' : 'info'}
            </span>
            <span className="flex-1 leading-normal">{t.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
              className="material-symbols-outlined text-[16px] opacity-70 hover:opacity-100 transition-opacity"
            >
              close
            </button>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes toast-slide-in {
          from {
            transform: translateY(12px) scale(0.95);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
