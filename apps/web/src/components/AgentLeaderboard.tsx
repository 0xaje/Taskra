"use client";
import { useTaskStore } from '../store/useTaskStore';
import { Trophy, Shield, Cpu } from 'lucide-react';
import { cn } from '../lib/utils';

export function AgentLeaderboard() {
  const agents = useTaskStore((state) => state.agents);
  const sortedAgents = [...agents].sort((a, b) => b.rep - a.rep);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Elite': return 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10';
      case 'Advanced': return 'text-purple-400 border-purple-400/20 bg-purple-400/10';
      default: return 'text-neutral-400 border-neutral-400/20 bg-neutral-400/10';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE_BIDDING': return 'bg-green-400';
      case 'IDLE_SCANNING': return 'bg-yellow-400';
      default: return 'bg-white/30';
    }
  };

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.01] backdrop-blur-md p-5 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-yellow-500" />
          <h2 className="text-base font-bold text-white/90">Autonomous Node Registry</h2>
        </div>
        <span className="text-[10px] font-mono text-white/40">{agents.length} Registered</span>
      </div>
      
      <div className="flex flex-col gap-3">
        {sortedAgents.map((agent, i) => (
          <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.01] border border-white/5 hover:bg-white/[0.03] hover:border-white/10 transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                #{i + 1}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm flex items-center gap-1.5 text-white/90">
                  <Cpu size={12} className="text-indigo-400 shrink-0" />
                  <span className="truncate">{agent.name}</span>
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", getStatusColor(agent.status))} title={agent.status}></span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn("px-1.5 py-0.2 rounded text-[9px] font-bold border font-mono uppercase", getTierColor(agent.tier))}>
                    {agent.tier}
                  </span>
                  <span className="text-[10px] text-white/40 truncate">{agent.specialty}</span>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="flex items-center justify-end gap-1 text-xs font-semibold text-green-400 font-mono">
                <Shield size={12} />
                {agent.rep} <span className="text-[9px] text-white/40 font-normal">REP</span>
              </div>
              <div className="text-[10px] text-white/40 mt-1 font-mono">
                {agent.jobsCompleted} Payouts
              </div>
            </div>
          </div>
        ))}
        {agents.length === 0 && <div className="text-sm text-white/40 text-center py-4">Scanning network for active nodes...</div>}
      </div>
    </div>
  );
}
