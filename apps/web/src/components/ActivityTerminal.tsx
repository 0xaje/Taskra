"use client";
import { useTaskStore } from '../store/useTaskStore';
import { Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function ActivityTerminal() {
  const events = useTaskStore((state) => state.events);

  return (
    <div className="rounded-xl border border-white/5 bg-[#0a0a0a] flex flex-col h-[400px] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02] flex items-center gap-2">
        <Terminal size={18} className="text-white/50" />
        <h3 className="font-semibold text-sm text-white/70">Autonomous Event Feed</h3>
      </div>
      <div className="flex-1 p-4 overflow-y-auto font-mono text-xs flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {events.length === 0 ? (
            <div className="text-white/30 text-center mt-10">Listening for network events...</div>
          ) : (
            events.map((ev, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-3"
              >
                <span className="text-white/30 shrink-0">[{ev.time}]</span>
                <span className={`
                  ${ev.type === 'primary' ? 'text-cyan-400 font-medium' : ''}
                  ${ev.type === 'secondary' ? 'text-green-400 font-medium' : ''}
                  ${ev.type === 'error' ? 'text-red-400 font-semibold' : ''}
                  ${ev.type === 'white' ? 'text-zinc-200' : ''}
                  ${ev.type === 'reasoning' ? 'text-indigo-400 font-bold' : ''}
                `}>
                  {ev.text}
                </span>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
