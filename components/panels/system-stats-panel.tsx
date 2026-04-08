'use client';

import { Cpu, HardDrive } from 'lucide-react';
import type { SystemMetrics } from '@/lib/types';

interface Props {
  history: SystemMetrics[];
}

export default function SystemStatsPanel({ history }: Props) {
  const latest = (history ?? [])?.[history?.length - 1 ?? 0];

  return (
    <div className="bg-[#141526] rounded-xl border border-[#2A2D45] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Cpu className="w-5 h-5 text-[#60B5FF]" />
        <h3 className="text-base font-semibold text-white">System Stats</h3>
      </div>

      <div className="space-y-3">
        {/* CPU */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#8B8FA3]">CPU Usage</span>
            <span className="text-xs font-bold text-white terminal-font">{latest?.cpuPercent?.toFixed?.(1) ?? '0'}%</span>
          </div>
          <div className="h-2 bg-[#0D0E1A] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${latest?.cpuPercent ?? 0}%`,
                background: `linear-gradient(90deg, #60B5FF, ${(latest?.cpuPercent ?? 0) > 80 ? '#FF4D6A' : '#00FFD1'})`,
              }}
            />
          </div>
        </div>

        {/* RAM */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#8B8FA3]">RAM Usage</span>
            <span className="text-xs font-bold text-white terminal-font">
              {latest?.ramUsed?.toFixed?.(1) ?? '0'} / {latest?.ramTotal ?? 64} GB
            </span>
          </div>
          <div className="h-2 bg-[#0D0E1A] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${latest?.ramPercent ?? 0}%`,
                background: `linear-gradient(90deg, #9D5CFF, ${(latest?.ramPercent ?? 0) > 80 ? '#FF4D6A' : '#FF9149'})`,
              }}
            />
          </div>
        </div>

        {/* Detected System Info */}
        <div className="mt-2 p-2 bg-[#0D0E1A] rounded-lg border border-[#2A2D45]">
          <div className="text-[11px] text-[#555570] uppercase tracking-wider mb-1 terminal-font">System Info</div>
          <div className="flex items-center gap-3 text-[11px] text-[#8B8FA3] terminal-font flex-wrap">
            <span>{latest?.platform ?? 'Unknown'}</span>
            <span>•</span>
            <span>{latest?.arch ?? 'Unknown'}</span>
            <span>•</span>
            <span>{latest?.ramTotal ? `${latest.ramTotal} GB RAM` : 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
