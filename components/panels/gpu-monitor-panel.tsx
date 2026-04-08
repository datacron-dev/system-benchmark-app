'use client';

import { useMemo } from 'react';
import { Microchip } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend
} from 'recharts';
import type { GpuMetrics } from '@/lib/types';

interface Props {
  history: GpuMetrics[];
}

export default function GpuMonitorPanel({ history }: Props) {
  const latestGpu = (history ?? [])?.[history?.length - 1 ?? 0];

  const chartData = useMemo(() => {
    return (history ?? []).map((m: GpuMetrics, i: number) => ({
      t: i,
      util: m?.utilization ?? 0,
      vram: Math.round((m?.vramUsed ?? 0) / 1024 * 10) / 10,
      power: m?.powerDraw ?? 0,
      temp: m?.temperature ?? 0,
    }));
  }, [history]);

  return (
    <div className="bg-[#141526] rounded-xl border border-[#2A2D45] p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Microchip className="w-5 h-5 text-[#00FFD1]" />
          <h3 className="text-base font-semibold text-white">GPU Monitor</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`status-dot ${latestGpu?.available ? 'online' : 'offline'}`} />
          <span className="text-xs text-[#8B8FA3]">
            {latestGpu?.available ? (latestGpu?.gpuName ?? 'GPU Detected') : 'No GPU Detected'}
          </span>
        </div>
      </div>

      {/* Live metrics badges */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <MetricBadge label="Utilization" value={`${latestGpu?.utilization ?? 0}%`} color="#00FFD1" />
        <MetricBadge label="VRAM" value={`${((latestGpu?.vramUsed ?? 0) / 1024).toFixed(1)} / ${((latestGpu?.vramTotal ?? 0) / 1024).toFixed(0)} GB`} color="#60B5FF" />
        <MetricBadge label="Power" value={`${latestGpu?.powerDraw ?? 0}W`} color="#FF9149" />
        <MetricBadge label="Temp" value={`${latestGpu?.temperature ?? 0}°C`} color="#FF4D6A" />
        <MetricBadge label="Clock" value={`${latestGpu?.clockSpeed ?? 0} MHz`} color="#9D5CFF" />
      </div>

      {/* Chart */}
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <XAxis
              dataKey="t"
              tickLine={false}
              tick={{ fontSize: 11, fill: '#8B8FA3' }}
              interval="preserveStartEnd"
              stroke="#2A2D45"
            />
            <YAxis
              tickLine={false}
              tick={{ fontSize: 11, fill: '#8B8FA3' }}
              stroke="#2A2D45"
              width={35}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1A1C30',
                border: '1px solid #2A2D45',
                borderRadius: '8px',
                fontSize: 11,
                color: '#E8E9F0',
              }}
            />
            <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="util" name="GPU %" stroke="#00FFD1" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="temp" name="Temp °C" stroke="#FF4D6A" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="power" name="Power W" stroke="#FF9149" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="vram" name="VRAM GB" stroke="#60B5FF" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MetricBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#0D0E1A] rounded-lg px-3 py-2 text-center">
      <p className="text-[11px] uppercase tracking-wider" style={{ color }}>{label ?? ''}</p>
      <p className="text-sm font-bold text-white terminal-font mt-0.5">{value ?? '-'}</p>
    </div>
  );
}
