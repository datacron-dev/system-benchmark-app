'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Square, Terminal, Zap, Loader2 } from 'lucide-react';
import type { BenchmarkParams } from '@/lib/types';
import { LOAD_PRESETS } from '@/lib/types';

interface Props {
  models: string[];
  running: boolean;
  logLines: string[];
  onRun: (params: BenchmarkParams) => void;
  onStop: () => void;
}

export default function BenchmarkRunnerPanel({ models, running, logLines, onRun, onStop }: Props) {
  const [model, setModel] = useState<string>((models ?? [])?.[0] ?? '');
  const [pp, setPp] = useState(512);
  const [tg, setTg] = useState(128);
  const [concurrency, setConcurrency] = useState(1);
  const [runs, setRuns] = useState(3);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ((models ?? []).length > 0 && !model) {
      setModel(models?.[0] ?? '');
    }
  }, [models, model]);

  useEffect(() => {
    if (logRef?.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logLines]);

  const applyPreset = (presetName: string) => {
    const preset = LOAD_PRESETS?.find?.((p: any) => p?.name === presetName);
    if (preset) {
      setPp(preset?.pp ?? 512);
      setTg(preset?.tg ?? 128);
      setConcurrency(preset?.concurrency ?? 1);
      setRuns(preset?.runs ?? 3);
    }
  };

  const handleRun = () => {
    onRun?.({ model: model || (models ?? [])?.[0] || 'llama3.1:8b', pp, tg, concurrency, runs });
  };

  return (
    <div className="bg-[#141526] rounded-xl border border-[#2A2D45] p-4">
      <div className="flex items-center gap-2 mb-4">
        <Terminal className="w-5 h-5 text-[#FF9149]" />
        <h3 className="text-base font-semibold text-white">Benchmark Runner</h3>
        {running && (
          <span className="ml-auto flex items-center gap-1 text-xs text-[#39FF14]">
            <Loader2 className="w-3 h-3 animate-spin" />
            Running
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-3 mb-4">
        {/* Model selector */}
        <div>
          <label className="text-[11px] uppercase tracking-wider text-[#8B8FA3] mb-1 block">Model</label>
          <select
            value={model}
            onChange={(e: any) => setModel(e?.target?.value ?? '')}
            disabled={running}
            className="w-full bg-[#0D0E1A] border border-[#2A2D45] rounded-lg px-3 py-2 text-sm text-white terminal-font focus:border-[#00FFD1] focus:outline-none disabled:opacity-50"
          >
            {(models ?? []).map((m: string) => (
              <option key={m} value={m}>{m ?? ''}</option>
            ))}
          </select>
        </div>

        {/* Parameter inputs */}
        <div className="grid grid-cols-4 gap-2">
          <ParamInput label="--pp" value={pp} onChange={setPp} disabled={running} />
          <ParamInput label="--tg" value={tg} onChange={setTg} disabled={running} />
          <ParamInput label="--concurrency" value={concurrency} onChange={setConcurrency} disabled={running} />
          <ParamInput label="--runs" value={runs} onChange={setRuns} disabled={running} />
        </div>

        {/* Presets */}
        <div>
          <label className="text-[11px] uppercase tracking-wider text-[#8B8FA3] mb-1 block">Load Presets</label>
          <div className="flex flex-wrap gap-2">
            {(LOAD_PRESETS ?? []).map((p: any) => (
              <button
                key={p?.name}
                onClick={() => applyPreset(p?.name ?? '')}
                disabled={running}
                className="px-3 py-1.5 rounded-lg text-xs bg-[#0D0E1A] border border-[#2A2D45] text-[#8B8FA3] hover:border-[#00FFD1] hover:text-[#00FFD1] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {p?.label ?? ''}
              </button>
            ))}
          </div>
        </div>

        {/* Run/Stop */}
        <div className="flex gap-2">
          <button
            onClick={handleRun}
            disabled={running}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm bg-[#00FFD1] text-[#0D0E1A] hover:bg-[#00b89a] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            Run Benchmark
          </button>
          <button
            onClick={() => onStop?.()}
            disabled={!running}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm bg-[#FF4D6A]/10 text-[#FF4D6A] border border-[#FF4D6A]/20 hover:bg-[#FF4D6A]/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Square className="w-4 h-4" />
            Stop
          </button>
        </div>
      </div>

      {/* Log Output */}
      <div>
        <label className="text-[11px] uppercase tracking-wider text-[#8B8FA3] mb-1 block">Live Output</label>
        <div
          ref={logRef}
          className="bg-[#0A0B14] rounded-lg p-3 h-[200px] overflow-y-auto log-window border border-[#1A1C30]"
        >
          {(logLines ?? []).length === 0 ? (
            <p className="text-[#3A3D55] italic">Waiting for benchmark to start...</p>
          ) : (
            (logLines ?? []).map((line: string, i: number) => (
              <div key={i} className={getLogLineClass(line ?? '')}>
                {line ?? ''}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ParamInput({ label, value, onChange, disabled }: {
  label: string; value: number; onChange: (v: number) => void; disabled: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-[#8B8FA3] mb-1 block">{label ?? ''}</label>
      <input
        type="number"
        value={value}
        onChange={(e: any) => onChange?.(parseInt(e?.target?.value ?? '0') || 0)}
        disabled={disabled}
        min={1}
        className="w-full bg-[#0D0E1A] border border-[#2A2D45] rounded-lg px-3 py-2 text-sm text-white terminal-font focus:border-[#00FFD1] focus:outline-none disabled:opacity-50"
      />
    </div>
  );
}

function getLogLineClass(line: string): string {
  const base = 'leading-relaxed';
  if (line?.includes?.('[ERROR]')) return `${base} text-[#FF4D6A]`;
  if (line?.includes?.('[INFO]')) return `${base} text-[#60B5FF]`;
  if (line?.includes?.('[RUN')) return `${base} text-[#00FFD1] font-medium`;
  if (line?.includes?.('BENCHMARK RESULTS')) return `${base} text-[#FF9149] font-bold`;
  if (line?.includes?.('complete:') || line?.includes?.('Complete')) return `${base} text-[#39FF14]`;
  if (line?.startsWith?.('|')) return `${base} text-[#9D5CFF]`;
  return `${base} text-[#8B8FA3]`;
}
