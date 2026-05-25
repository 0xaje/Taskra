import { motion } from 'framer-motion';
import { Task } from '../store/useTaskStore';
import { cn } from '../lib/utils';
import { Activity, Clock, CheckCircle, Server, AlertCircle, Cpu } from 'lucide-react';

export function AnimatedTaskCard({ task }: { task: Task }) {
  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'NEW': return 'text-sky-400 border-sky-400/20 bg-sky-400/10';
      case 'OPEN': return 'text-green-400 border-green-400/20 bg-green-400/10';
      case 'IN_PROGRESS': return 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10';
      case 'SOLVED': return 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10';
      case 'ASSIGNED': return 'text-purple-400 border-purple-400/20 bg-purple-400/10';
      case 'COMPLETED': return 'text-blue-400 border-blue-400/20 bg-blue-400/10';
      case 'SETTLED': return 'text-neutral-400 border-neutral-400/20 bg-neutral-400/10';
      case 'CANCELLED': return 'text-red-400 border-red-400/20 bg-red-400/10';
      default: return 'text-white border-white/10 bg-white/5';
    }
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'OPEN':
      case 'NEW': 
        return <Clock size={14} className="animate-pulse" />;
      case 'IN_PROGRESS': 
        return <Activity size={14} className="animate-spin" style={{ animationDuration: '3s' }} />;
      case 'SETTLED':
      case 'COMPLETED':
      case 'SOLVED': 
        return <CheckCircle size={14} />;
      case 'CANCELLED': 
        return <AlertCircle size={14} />;
      default: 
        return <Server size={14} />;
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="p-5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/10 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 backdrop-blur-md relative overflow-hidden flex flex-col justify-between min-h-[160px]"
    >
      {/* Decorative colored glow based on category */}
      <div className={cn(
        "absolute -right-16 -top-16 w-32 h-32 rounded-full blur-[60px] opacity-10 pointer-events-none",
        task.category === 'Security' && 'bg-red-500',
        task.category === 'DeFi' && 'bg-green-500',
        task.category === 'Data Mining' && 'bg-blue-500',
        task.category === 'Strategy' && 'bg-purple-500',
        task.category === 'Infrastructure' && 'bg-yellow-500'
      )}></div>

      <div>
        <div className="flex justify-between items-start gap-4 mb-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400/80">{task.category}</span>
            <h3 className="font-semibold text-base text-white/90 leading-snug">{task.title}</h3>
          </div>
          <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border shrink-0 font-mono", getStatusColor(task.status))}>
            {getStatusIcon(task.status)}
            {task.status}
          </span>
        </div>
        
        <p className="text-xs text-white/50 line-clamp-2 leading-relaxed mb-4">
          {task.desc}
        </p>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
        <div className="flex items-center gap-1.5 text-[11px] text-white/40 font-mono">
          <span>ID:</span>
          <span className="text-white/60">{task.id.slice(0, 10)}</span>
        </div>
        <div className="flex items-center gap-2">
          {task.assignedAgentId && (
            <div className="flex items-center gap-1 text-[11px] bg-white/5 px-2 py-0.5 rounded border border-white/5 text-white/60">
              <Cpu size={10} className="text-indigo-400" />
              <span>{task.assignedAgentId}</span>
            </div>
          )}
          <div className="font-mono text-indigo-400 font-extrabold text-base bg-indigo-500/5 border border-indigo-500/10 px-2 py-0.5 rounded">
            {Number(task.reward).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {task.rewardType}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
