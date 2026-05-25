"use client";
import { useTaskStore } from '../store/useTaskStore';
import { AnimatedTaskCard } from './AnimatedTaskCard';
import { AnimatePresence } from 'framer-motion';

export function TaskFeed() {
  const tasks = useTaskStore((state) => state.tasks);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold bg-gradient-to-r from-white to-white/50 bg-clip-text text-transparent">Live Task Marketplace</h2>
        <span className="flex items-center gap-2 text-xs font-medium text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full border border-green-400/20">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          LIVE
        </span>
      </div>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {tasks.map((task) => (
            <AnimatedTaskCard key={task.id} task={task} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
