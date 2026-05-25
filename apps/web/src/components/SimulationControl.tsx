"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Zap, Cpu, ChevronRight } from 'lucide-react';

interface SimState {
  isActive: boolean;
  tickCount: number;
  speedMs: number;
}

const STEPS = [
  { label: 'Task Spawn',    icon: '📋', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  { label: 'Agent Bid',     icon: '⚡', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { label: 'Execution',     icon: '⚙️', color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  { label: 'Validation',    icon: '🔍', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { label: 'Settlement',    icon: '💸', color: 'text-green-400',  bg: 'bg-green-500/10' },
];

export function SimulationControl() {
  const [simState, setSimState] = useState<SimState | null>(null);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${apiUrl}/system/simulation/status`);
      if (res.ok) setSimState(await res.json());
    } catch (_) {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const toggle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/system/simulation/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !simState?.isActive }),
      });
      if (res.ok) setSimState(await res.json());
    } catch (_) {}
    setLoading(false);
  };

  const triggerTick = async () => {
    setTriggering(true);
    try {
      await fetch(`${apiUrl}/system/simulation/trigger`, { method: 'POST' });
    } catch (_) {}
    setTimeout(() => setTriggering(false), 800);
  };

  const currentStep = simState ? simState.tickCount % 5 : 0;
  const isActive = simState?.isActive ?? false;

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg ${isActive ? 'bg-green-500/15' : 'bg-white/5'}`}>
            <Cpu size={16} className={isActive ? 'text-green-400' : 'text-white/40'} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white/90">Autonomous Demo Engine</h3>
            <p className="text-[11px] text-white/30 mt-0.5">Self-directed digital economy simulation</p>
          </div>
        </div>

        {/* Live/Paused badge */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isActive ? 'live' : 'paused'}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
              isActive
                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                : 'bg-white/5 text-white/40 border-white/10'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
            {isActive ? 'Live' : 'Paused'}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pipeline Stepper */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {STEPS.map((step, i) => {
            const isPast    = isActive && i < currentStep;
            const isCurrent = isActive && i === currentStep;
            return (
              <div key={step.label} className="flex items-center gap-1.5 shrink-0">
                <motion.div
                  animate={{ scale: isCurrent ? [1, 1.05, 1] : 1 }}
                  transition={{ repeat: isCurrent ? Infinity : 0, duration: 1.4 }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-300 ${
                    isCurrent
                      ? `${step.bg} ${step.color} border-current/30 shadow-sm`
                      : isPast
                      ? 'bg-white/5 text-white/60 border-white/10'
                      : 'bg-transparent text-white/25 border-white/5'
                  }`}
                >
                  <span className="text-sm leading-none">{step.icon}</span>
                  <span className="hidden sm:block">{step.label}</span>
                </motion.div>
                {i < STEPS.length - 1 && (
                  <ChevronRight size={10} className={isPast || isCurrent ? 'text-white/30' : 'text-white/10'} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Row */}
      <div className="px-5 pb-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Ticks Completed</p>
            <p className="text-xl font-bold text-white font-mono">
              {simState?.tickCount ?? 0}
            </p>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Tick Speed</p>
            <p className="text-xl font-bold text-white font-mono">
              {((simState?.speedMs ?? 8000) / 1000).toFixed(0)}s
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <button
            onClick={toggle}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
              isActive
                ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                : 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
            } disabled:opacity-50`}
          >
            {isActive ? <Pause size={13} /> : <Play size={13} />}
            {loading ? 'Updating…' : isActive ? 'Pause Simulation' : 'Start Simulation'}
          </button>

          <button
            onClick={triggerTick}
            disabled={triggering}
            title="Manually advance one simulation step"
            className="px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white/90 transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            <Zap size={13} className={triggering ? 'text-yellow-400' : ''} />
            <span className="hidden sm:block">Tick</span>
          </button>
        </div>
      </div>

      {/* Activity pulse strip */}
      {isActive && (
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-green-500/60 to-transparent animate-pulse" />
      )}
    </div>
  );
}
