'use client';

import { BarChart3, TrendingUp, Clock, Zap, Timer, Gauge } from 'lucide-react';
import type { BenchmarkResult } from '@/lib/types';

interface Props {
  result: Partial<BenchmarkResult> | null;
}

export default function ResultsPanel({ result }: Props) {
  const metrics = [
    { icon: Gauge, label: 't/s (total)', value: result?.tsTotal, unit: 't/s', color: '#00FFD1' },
    { icon: TrendingUp, label: 't/s (per req)', value: result?.tsReq, unit: 't/s', color: '#60B5FF' },
    { icon: Zap, label: 'Peak t/s', value: result?.peakTs, unit: 't/s', color: '#FF9149' },
    { icon: Clock, label: 'TTFR', value: result?.ttfr, unit: 'ms', color: '#9D5CFF' },
    { icon: Timer, label: 'est_ppt', value: result?.estPpt, unit: 'ms', color: '#FF9898' },
    { icon: BarChart3, label: 'Duration', value: result?.duration, unit: 's', color: '#80D8C3' },
  ];

  return (
    <div className="bg-[#141526] rounded-xl border border-[#2A2D45] p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#39FF14]" />
          <h3 className="text-base font-semibold text-white">Results</h3>
        </div>
        {result?.status && (
          <span className={`px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wider ${
            result.status === 'completed' ? 'bg-[#39FF14]/10 text-[#39FF14]' :
            result.status === 'running' ? 'bg-[#60B5FF]/10 text-[#60B5FF]' :
            result.status === 'failed' ? 'bg-[#FF4D6A]/10 text-[#FF4D6A]' :
            'bg-[#FF9149]/10 text-[#FF9149]'
          }`}>
            {result?.status ?? ''}
          </span>
        )}
      </div>

      {result ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {metrics.map((m: any) => {
            const Icon = m?.icon;
            return (
              <div
                key={m?.label}
                className="bg-[#0D0E1A] rounded-lg p-3 text-center border border-[#1A1C30] hover:border-[#2A2D45] transition-colors"
              >
                {Icon && <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: m?.color ?? '#fff' }} />}
                <p className="text-lg font-bold text-white terminal-font">
                  {m?.value != null ? (typeof m.value === 'number' ? m.value.toFixed(1) : m.value) : '-'}
                </p>
                <p className="text-[11px] text-[#8B8FA3]">{m?.label ?? ''} ({m?.unit ?? ''})</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-[200px] text-[#3A3D55]">
          <BarChart3 className="w-12 h-12 mb-3" />
          <p className="text-sm">No benchmark results yet</p>
          <p className="text-xs mt-1">Run a benchmark to see results here</p>
        </div>
      )}

      {/* Model info */}
      {result?.model && (
        <div className="mt-4 pt-3 border-t border-[#2A2D45] flex items-center justify-between text-xs text-[#8B8FA3]">
          <span>Model: <span className="text-[#00FFD1] terminal-font">{result?.model ?? ''}</span></span>
          <span>PP: {result?.pp ?? '-'} | TG: {result?.tg ?? '-'} | C: {result?.concurrency ?? '-'}</span>
        </div>
      )}
    </div>
  );
}
