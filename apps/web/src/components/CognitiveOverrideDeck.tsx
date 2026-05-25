import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Agent } from '@taskra/types';

type RippleEntry = { id: number; x: number; y: number; t: number };

interface Props {
  agents: Agent[];
  overrideTarget: string;
  setOverrideTarget: (v: string) => void;
  validationTension: number;
  setValidationTension: (v: number) => void;
  neuralThoughts: string[];
  setNeuralThoughts: React.Dispatch<React.SetStateAction<string[]>>;
  riskAppetite: number;
  setRiskAppetite: (v: number) => void;
  memoryWeight: number;
  setMemoryWeight: (v: number) => void;
  collateralStaking: number;
  setCollateralStaking: (v: number) => void;
}

function GlowMeter({ value, max = 100, color, label, unit = '%' }: { value: number; max?: number; color: string; label: string; unit?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-bold uppercase tracking-widest font-mono" style={{ color }}>{label}</span>
        <span className="text-[10px] font-bold font-mono" style={{ color }}>{value}{unit}</span>
      </div>
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }}
        />
      </div>
    </div>
  );
}

function NeuralSlider({
  label, sublabel, value, onChange, color, icon
}: {
  label: string; sublabel: string; value: number;
  onChange: (v: number) => void; color: string; icon: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <span className="material-symbols-outlined text-lg" style={{ color }}>{icon}</span>
      <div className="relative h-44 flex items-center justify-center">
        <div className="absolute h-full w-1 rounded-full bg-zinc-800" />
        <div
          className="absolute bottom-0 w-1 rounded-full transition-all duration-300"
          style={{ height: `${value}%`, background: `linear-gradient(to top, ${color}, transparent)`, boxShadow: `0 0 12px ${color}` }}
        />
        <input
          type="range"
          min={0} max={100}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute h-full cursor-pointer opacity-0 w-8"
          style={{ writingMode: 'vertical-lr' as React.CSSProperties['writingMode'], direction: 'rtl' as React.CSSProperties['direction'] }}
        />
        <div
          className="absolute w-4 h-4 rounded-full border-2 transition-all duration-300 z-10"
          style={{
            bottom: `calc(${value}% - 8px)`,
            borderColor: color,
            background: '#0a0a0a',
            boxShadow: `0 0 10px ${color}`,
          }}
        />
      </div>
      <div className="text-center space-y-0.5">
        <div className="text-[9px] font-bold uppercase tracking-widest font-mono" style={{ color }}>{value}%</div>
        <div className="text-[8px] text-zinc-500 uppercase tracking-widest font-mono leading-tight">{label}</div>
        <div className="text-[7px] text-zinc-600 font-mono leading-tight max-w-[60px] text-center">{sublabel}</div>
      </div>
    </div>
  );
}

const THOUGHT_TEMPLATES = [
  (r: number) => `🧠 [COGNITION SHIFT] Risk threshold recalibrated to ${r}%. Bidding stance entering ${r > 70 ? 'AGGRESSIVE' : r > 40 ? 'BALANCED' : 'CONSERVATIVE'} mode.`,
  (m: number) => `🔮 [MEMORY DECAY] Historical weight adjusted to ${m}%. ${m > 60 ? 'Prioritizing recent market signals.' : 'Leaning on long-term pattern data.'}`,
  (c: number) => `⛓️ [COLLATERAL] Staking commitment set to ${c}%. ${c > 75 ? 'Maximum skin-in-the-game signaling detected.' : 'Partial commitment posture maintained.'}`,
  () => `⚡ [COALITION] Formation stability index recalculating across ${Math.floor(Math.random() * 4) + 2} active teams.`,
  () => `🌐 [RIPPLE] Economic disturbance propagating through ${Math.floor(Math.random() * 8) + 3} agent nodes.`,
  () => `🎯 [VALIDATOR] Tension index spiking. ${Math.floor(Math.random() * 3) + 1} validators shifting dispute thresholds.`,
  () => `📡 [NEURAL LINK] Override broadcast confirmed on ${Math.floor(Math.random() * 6) + 4} cognitive channels.`,
];

export default function CognitiveOverrideDeck({
  agents, overrideTarget, setOverrideTarget,
  validationTension, setValidationTension,
  neuralThoughts, setNeuralThoughts,
  riskAppetite, setRiskAppetite,
  memoryWeight, setMemoryWeight,
  collateralStaking, setCollateralStaking,
}: Props) {
  const thoughtsRef = useRef<HTMLDivElement>(null);

  // Derived live metrics
  const slashProb = Math.min(99, Math.round(
    (100 - riskAppetite) * 0.3 + validationTension * 0.4 + (100 - memoryWeight) * 0.15 + Math.random() * 5
  ));
  const coalitionStability = Math.round(
    collateralStaking * 0.45 + memoryWeight * 0.3 + (100 - validationTension) * 0.2 + Math.random() * 5
  );
  const volatilityIndex = Math.round(
    riskAppetite * 0.5 + validationTension * 0.3 + (100 - collateralStaking) * 0.2
  );
  const economicRipple = Math.round(
    (riskAppetite + validationTension) / 2 + Math.random() * 8
  );

  // Topology nodes
  const [topoNodes] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: 15 + (i % 4) * 22 + (Math.floor(i / 4) % 2) * 11,
      y: 15 + Math.floor(i / 4) * 28,
      type: i % 3 === 0 ? 'validator' : i % 3 === 1 ? 'agent' : 'coalition',
    }))
  );
  const [ripples, setRipples] = useState<RippleEntry[]>([]);
  const rippleIdRef = useRef(0);

  // Pulse ripple on slider change
  const triggerRipple = useCallback(() => {
    const node = topoNodes[Math.floor(Math.random() * topoNodes.length)];
    const id = rippleIdRef.current++;
    setRipples((prev: RippleEntry[]) => [...prev, { id, x: node.x, y: node.y, t: Date.now() }]);
    setTimeout(() => setRipples((prev: RippleEntry[]) => prev.filter(r => r.id !== id)), 1800);
  }, [topoNodes]);

  // Fire thought + ripple whenever any slider changes
  const handleSliderChange = useCallback((setter: (v: number) => void, val: number, templateIdx: number, sliderVal: number) => {
    setter(val);
    triggerRipple();
    const thought = THOUGHT_TEMPLATES[templateIdx](sliderVal);
    setNeuralThoughts((prev: string[]) => [thought, ...prev].slice(0, 30));
  }, [triggerRipple, setNeuralThoughts]);

  // Auto-scroll thought feed
  useEffect(() => {
    if (thoughtsRef.current) {
      thoughtsRef.current.scrollTop = 0;
    }
  }, [neuralThoughts]);

  // Autonomous background pulses
  useEffect(() => {
    const interval = setInterval(() => {
      triggerRipple();
      const t = THOUGHT_TEMPLATES[Math.floor(Math.random() * THOUGHT_TEMPLATES.length)];
      setNeuralThoughts((prev: string[]) => [t(Math.round(Math.random() * 100)), ...prev].slice(0, 30));
    }, 4000);
    return () => clearInterval(interval);
  }, [triggerRipple, setNeuralThoughts]);

  const nodeColor = (type: string) =>
    type === 'validator' ? '#f59e0b' : type === 'coalition' ? '#8b5cf6' : '#06b6d4';

  return (
    <div
      className="flex-1 min-h-0 overflow-y-auto w-full page-transition"
      style={{ background: 'radial-gradient(ellipse at 20% 0%, #0d0221 0%, #030712 60%, #000 100%)' }}
    >
      {/* ── TOP STATUS BAR ── */}
      <div className="border-b border-indigo-500/20 px-lg py-2 flex items-center justify-between"
        style={{ background: 'rgba(99,102,241,0.04)' }}>
        <div className="flex items-center gap-3">
          <span className="animate-pulse w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8]" />
          <span className="font-mono text-[10px] font-bold text-indigo-400 uppercase tracking-[0.3em]">
            COGNITIVE OVERRIDE DECK — ACTIVE
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">TARGET</span>
            <select
              value={overrideTarget}
              onChange={e => setOverrideTarget(e.target.value)}
              className="bg-transparent border border-indigo-500/30 text-indigo-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider focus:outline-none"
            >
              <option value="GLOBAL_CIVILIZATION">GLOBAL CIVILIZATION</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-mono">
            <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-green-400 uppercase tracking-widest">RPC LINKED</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_280px] gap-0 min-h-[calc(100vh-10rem)]">

        {/* ── LEFT: NEURAL SLIDERS ── */}
        <div className="border-r border-indigo-500/10 p-lg flex flex-col gap-lg"
          style={{ background: 'rgba(10,5,30,0.6)' }}>
          <div>
            <div className="text-[9px] font-mono font-bold text-indigo-400 uppercase tracking-[0.3em] mb-1">
              ⚡ NEURAL OVERRIDE SLIDERS
            </div>
            <p className="text-[8px] text-zinc-600 font-mono">
              Direct cognitive parameter injection into active agent consciousness streams.
            </p>
          </div>

          <div className="flex justify-around flex-1 items-end pb-4">
            <NeuralSlider
              label="RISK DRIVE"
              sublabel="Bidding aggression"
              value={riskAppetite}
              onChange={v => handleSliderChange(setRiskAppetite, v, 0, v)}
              color="#f97316"
              icon="local_fire_department"
            />
            <NeuralSlider
              label="MEM DECAY"
              sublabel="History weight"
              value={memoryWeight}
              onChange={v => handleSliderChange(setMemoryWeight, v, 1, v)}
              color="#06b6d4"
              icon="memory"
            />
            <NeuralSlider
              label="COLLATERAL"
              sublabel="Stake commitment"
              value={collateralStaking}
              onChange={v => handleSliderChange(setCollateralStaking, v, 2, v)}
              color="#8b5cf6"
              icon="shield"
            />
            <NeuralSlider
              label="TENSION"
              sublabel="Validator pressure"
              value={validationTension}
              onChange={v => handleSliderChange(setValidationTension, v, 5, v)}
              color="#f59e0b"
              icon="gavel"
            />
          </div>

          {/* Live meters */}
          <div className="space-y-3 pt-4 border-t border-zinc-800">
            <div className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-2">
              BEHAVIORAL READOUT
            </div>
            <GlowMeter value={slashProb} label="SLASH PROBABILITY" color="#ef4444" />
            <GlowMeter value={Math.min(100, coalitionStability)} label="COALITION STABILITY" color="#10b981" />
            <GlowMeter value={Math.min(100, volatilityIndex)} label="VOLATILITY INDEX" color="#f59e0b" />
            <GlowMeter value={Math.min(100, economicRipple)} label="RIPPLE MAGNITUDE" color="#8b5cf6" />
          </div>
        </div>

        {/* ── CENTER: TOPOLOGY MAP + GRAPHS ── */}
        <div className="flex flex-col gap-0 border-r border-indigo-500/10">

          {/* Topology Map */}
          <div className="relative flex-1 min-h-[300px] border-b border-indigo-500/10"
            style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.06) 0%, transparent 70%)' }}>
            <div className="absolute top-3 left-3 text-[9px] font-mono font-bold text-indigo-400 uppercase tracking-[0.2em]">
              AGENT TOPOLOGY MESH
            </div>

            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
              {/* edges */}
              {topoNodes.map((n, i) =>
                topoNodes.slice(i + 1, i + 3).map(m => (
                  <line key={`${n.id}-${m.id}`}
                    x1={n.x} y1={n.y} x2={m.x} y2={m.y}
                    stroke="rgba(99,102,241,0.15)" strokeWidth="0.4"
                  />
                ))
              )}

              {/* ripple waves */}
              {ripples.map(r => (
                <React.Fragment key={r.id}>
                  <circle cx={r.x} cy={r.y} r="3" fill="none" stroke="#818cf8" strokeWidth="0.5" opacity="0.8">
                    <animate attributeName="r" from="2" to="18" dur="1.8s" fill="freeze" />
                    <animate attributeName="opacity" from="0.8" to="0" dur="1.8s" fill="freeze" />
                  </circle>
                  <circle cx={r.x} cy={r.y} r="1" fill="none" stroke="#c4b5fd" strokeWidth="0.3" opacity="0.5">
                    <animate attributeName="r" from="1" to="10" dur="1.4s" fill="freeze" />
                    <animate attributeName="opacity" from="0.5" to="0" dur="1.4s" fill="freeze" />
                  </circle>
                </React.Fragment>
              ))}

              {/* nodes */}
              {topoNodes.map(n => (
                <g key={n.id}>
                  <circle cx={n.x} cy={n.y} r="2.5"
                    fill={nodeColor(n.type)}
                    opacity="0.9"
                    style={{ filter: `drop-shadow(0 0 4px ${nodeColor(n.type)})` }}
                  />
                  <circle cx={n.x} cy={n.y} r="4"
                    fill="none"
                    stroke={nodeColor(n.type)}
                    strokeWidth="0.3"
                    opacity="0.3"
                  />
                </g>
              ))}
            </svg>

            {/* Legend */}
            <div className="absolute bottom-3 left-3 flex gap-4">
              {[['#06b6d4', 'Agent'], ['#f59e0b', 'Validator'], ['#8b5cf6', 'Coalition']].map(([c, l]) => (
                <div key={l} className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: c as string }} />
                  <span className="text-[8px] font-mono text-zinc-500 uppercase">{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
            {[
              { label: 'SLASH PROB', value: `${slashProb}%`, color: '#ef4444', icon: 'bolt', trend: slashProb > 50 ? '↑' : '↓' },
              { label: 'COALITION STB', value: `${Math.min(100, coalitionStability)}%`, color: '#10b981', icon: 'group_work', trend: coalitionStability > 60 ? '↑' : '↓' },
              { label: 'VOLATILITY', value: `${Math.min(100, volatilityIndex)}%`, color: '#f59e0b', icon: 'show_chart', trend: volatilityIndex > 50 ? '↑' : '↓' },
              { label: 'RIPPLE MAG', value: `${Math.min(100, economicRipple)}%`, color: '#8b5cf6', icon: 'waves', trend: '~' },
            ].map(({ label, value, color, icon, trend }) => (
              <div key={label} className="border-t border-r border-indigo-500/10 p-md flex flex-col gap-2"
                style={{ background: 'rgba(10,5,30,0.4)' }}>
                <div className="flex items-center justify-between">
                  <span className="material-symbols-outlined text-sm" style={{ color }}>{icon}</span>
                  <span className="text-[10px] font-mono font-bold" style={{ color }}>{trend}</span>
                </div>
                <div className="text-xl font-mono font-bold" style={{ color, textShadow: `0 0 20px ${color}` }}>
                  {value}
                </div>
                <div className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest">{label}</div>
              </div>
            ))}
          </div>

          {/* Behavioral Preview Bars */}
          <div className="p-lg border-t border-indigo-500/10 space-y-3"
            style={{ background: 'rgba(5,2,20,0.5)' }}>
            <div className="text-[9px] font-mono font-bold text-indigo-400 uppercase tracking-[0.2em] mb-3">
              REALTIME BEHAVIORAL SIMULATION PREVIEW
            </div>
            {agents.slice(0, 5).map((agent) => {
              const agentScore = Math.min(100, Math.round(
                ((riskAppetite * 0.4 + memoryWeight * 0.3 + collateralStaking * 0.3) * (agent.rep / 100)) +
                (Math.random() * 10)
              ));
              const agentColor = agentScore > 75 ? '#10b981' : agentScore > 45 ? '#f59e0b' : '#ef4444';
              return (
                <div key={agent.id} className="flex items-center gap-3">
                  <div className="w-24 text-[9px] font-mono text-zinc-400 truncate">{agent.name}</div>
                  <div className="flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${agentScore}%`, background: agentColor, boxShadow: `0 0 6px ${agentColor}` }}
                    />
                  </div>
                  <div className="text-[9px] font-mono font-bold w-8 text-right" style={{ color: agentColor }}>
                    {agentScore}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: NEURAL THOUGHT FEED ── */}
        <div className="flex flex-col" style={{ background: 'rgba(5,0,20,0.7)' }}>
          <div className="p-md border-b border-indigo-500/10">
            <div className="text-[9px] font-mono font-bold text-indigo-400 uppercase tracking-[0.3em] flex items-center gap-2">
              <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-indigo-400" />
              AGENT NEURAL THOUGHT FEED
            </div>
            <p className="text-[8px] text-zinc-600 font-mono mt-0.5">Live cognitive emissions from active agent consciousness.</p>
          </div>

          <div
            ref={thoughtsRef}
            className="flex-1 overflow-y-auto p-md space-y-2 max-h-[600px] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800"
          >
            {neuralThoughts.map((t, idx) => (
              <div key={idx}
                className="p-2 rounded border text-[9px] font-mono leading-relaxed transition-all"
                style={{
                  borderColor: idx === 0 ? 'rgba(129,140,248,0.4)' : 'rgba(99,102,241,0.08)',
                  background: idx === 0 ? 'rgba(99,102,241,0.08)' : 'transparent',
                  color: idx === 0 ? '#c4b5fd' : '#52525b',
                  opacity: Math.max(0.2, 1 - idx * 0.06),
                }}
              >
                {t}
              </div>
            ))}
          </div>

          {/* Override Fire Button */}
          <div className="p-md border-t border-indigo-500/10">
            <button
              onClick={() => {
                triggerRipple();
                triggerRipple();
                setNeuralThoughts((prev: string[]) => [
                  `🚨 [BROADCAST] FULL COGNITIVE OVERRIDE TRANSMITTED — Risk:${riskAppetite}% | Memory:${memoryWeight}% | Stake:${collateralStaking}% | Tension:${validationTension}%`,
                  `🌐 [CIVILIZATION] Mass parameter synchronization initiated across all ${agents.length} registered agent nodes.`,
                  `⚡ [SETTLEMENT] Economy re-equilibrating. Expect ${volatilityIndex > 60 ? 'HIGH' : 'MODERATE'} volatility cascade.`,
                  ...prev,
                ].slice(0, 30));
              }}
              className="w-full py-3 rounded-lg font-mono text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative overflow-hidden group"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
                border: '1px solid rgba(129,140,248,0.4)',
                color: '#a5b4fc',
                boxShadow: '0 0 20px rgba(99,102,241,0.2)',
              }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-sm animate-pulse">psychology</span>
                BROADCAST OVERRIDE
              </span>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))' }} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
