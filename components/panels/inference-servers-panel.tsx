'use client';

import { Server, Cpu } from 'lucide-react';
import type { InferenceServerType, ServerStatusEntry } from '@/lib/types';

interface Props {
  servers: ServerStatusEntry[];
}

const SERVER_LABELS: Record<InferenceServerType, string> = {
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
};

const SERVER_COLORS: Record<InferenceServerType, string> = {
  ollama: '#9D5CFF',
  lmstudio: '#60B5FF',
};

export default function InferenceServersPanel({ servers }: Props) {
  if (!servers || servers.length === 0) {
    return (
      <div className="bg-[#141526] rounded-xl border border-[#2A2D45] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Server className="w-5 h-5 text-[#8B8FA3]" />
          <h3 className="text-base font-semibold text-white">Inference Servers</h3>
        </div>
        <p className="text-xs text-[#8B8FA3]">No inference servers detected</p>
      </div>
    );
  }

  return (
    <div className="bg-[#141526] rounded-xl border border-[#2A2D45] p-4 space-y-3">
      <h3 className="text-base font-semibold text-white flex items-center gap-2">
        <Server className="w-5 h-5 text-[#8B8FA3]" />
        Inference Servers
      </h3>

      {servers.map((s) => {
        const label = SERVER_LABELS[s.server ?? 'ollama'];
        const color = SERVER_COLORS[s.server ?? 'ollama'];
        return (
          <div key={s.server} className="rounded-lg bg-[#0D0E1A] p-3 border border-[#2A2D45]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4" style={{ color }} />
                <span className="text-sm font-medium text-white">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`status-dot ${s.running ? 'online' : 'offline'}`} />
                <span className="text-xs text-[#8B8FA3]">{s.running ? 'Online' : 'Offline'}</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#8B8FA3] flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  Model
                </span>
                <span className="text-[#00FFD1] terminal-font truncate ml-2 max-w-[140px]">
                  {s.loadedModel ?? 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B8FA3]">Processor</span>
                <span className="text-white">{s.processor ?? 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B8FA3]">VRAM</span>
                <span className="text-white">{s.vramUsed ?? 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B8FA3]">Models</span>
                <span className="text-white">{s.availableModels?.length ?? 0}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
