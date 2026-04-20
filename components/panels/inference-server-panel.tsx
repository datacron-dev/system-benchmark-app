'use client';

import { Server, Cpu } from 'lucide-react';
import type { InferenceServerStatus } from '@/lib/types';

interface Props {
  status: InferenceServerStatus;
}

const SERVER_LABELS: Record<string, string> = {
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
};

export default function InferenceServerPanel({ status }: Props) {
  const serverLabel = status?.server ? SERVER_LABELS[status.server] : 'Inference Server';
  const serverColor = status?.server === 'lmstudio' ? '#60B5FF' : '#9D5CFF';

  return (
    <div className="bg-[#141526] rounded-xl border border-[#2A2D45] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5" style={{ color: serverColor }} />
          <h3 className="text-base font-semibold text-white">{serverLabel}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`status-dot ${status?.running ? 'online' : 'offline'}`} />
          <span className="text-xs text-[#8B8FA3]">{status?.running ? 'Connected' : 'Offline'}</span>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-[#8B8FA3]">Loaded Model</span>
          <span className="text-[#00FFD1] terminal-font truncate ml-2 max-w-[160px]">
            {status?.loadedModel ?? 'None'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#8B8FA3]">Processor</span>
          <span className="text-white">{status?.processor ?? 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#8B8FA3]">VRAM Used</span>
          <span className="text-white">{status?.vramUsed ?? 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#8B8FA3]">Available Models</span>
          <span className="text-white">{status?.availableModels?.length ?? 0}</span>
        </div>
      </div>
    </div>
  );
}
