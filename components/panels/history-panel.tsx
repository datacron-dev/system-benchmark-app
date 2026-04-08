'use client';

import { useState } from 'react';
import { History, Trash2, Download, RefreshCw, Search, Filter } from 'lucide-react';
import type { BenchmarkResult } from '@/lib/types';

interface Props {
  benchmarks: BenchmarkResult[];
  onRefresh: () => void;
}

export default function HistoryPanel({ benchmarks, onRefresh }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = (benchmarks ?? []).filter((b: BenchmarkResult) => {
    const matchesSearch = !search || (b?.model ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || b?.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (id: string) => {
    if (!id) return;
    try {
      await fetch(`/api/benchmarks/${id}`, { method: 'DELETE' });
      onRefresh?.();
    } catch (e: any) {
      console.error('Delete failed:', e);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8FA3]" />
          <input
            type="text"
            placeholder="Search models..."
            value={search}
            onChange={(e: any) => setSearch(e?.target?.value ?? '')}
            className="w-full bg-[#141526] border border-[#2A2D45] rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-[#00FFD1] focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e?.target?.value ?? 'all')}
            className="bg-[#141526] border border-[#2A2D45] rounded-lg px-3 py-2 text-sm text-white focus:border-[#00FFD1] focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="running">Running</option>
            <option value="failed">Failed</option>
            <option value="stopped">Stopped</option>
          </select>
          <button
            onClick={() => onRefresh?.()}
            className="p-2 rounded-lg bg-[#141526] border border-[#2A2D45] text-[#8B8FA3] hover:text-white hover:border-[#3A3D55] transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <a
            href="/api/benchmarks/export/csv"
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#141526] border border-[#2A2D45] text-[#8B8FA3] hover:text-[#00FFD1] hover:border-[#00FFD1]/30 text-sm transition-all"
          >
            <Download className="w-4 h-4" />
            CSV
          </a>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#141526] rounded-xl border border-[#2A2D45] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0D0E1A] border-b border-[#2A2D45]">
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-[#8B8FA3] font-medium">Date</th>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-[#8B8FA3] font-medium">Model</th>
                <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider text-[#8B8FA3] font-medium">PP</th>
                <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider text-[#8B8FA3] font-medium">TG</th>
                <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider text-[#8B8FA3] font-medium">Conc.</th>
                <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider text-[#00FFD1] font-medium">t/s Total</th>
                <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider text-[#9D5CFF] font-medium">TTFR (ms)</th>
                <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider text-[#8B8FA3] font-medium">Status</th>
                <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider text-[#8B8FA3] font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered?.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[#3A3D55]">
                    <History className="w-8 h-8 mx-auto mb-2" />
                    <p>No benchmark history found</p>
                    <p className="text-xs mt-1">Run benchmarks to see them here</p>
                  </td>
                </tr>
              ) : (
                filtered.map((b: BenchmarkResult) => (
                  <tr key={b?.id} className="border-b border-[#1A1C30] hover:bg-[#1A1C30]/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-[#8B8FA3] terminal-font">
                      {b?.createdAt ? new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#00FFD1] terminal-font truncate max-w-[180px]">{b?.model ?? '-'}</td>
                    <td className="px-4 py-3 text-center text-xs text-white">{b?.pp ?? '-'}</td>
                    <td className="px-4 py-3 text-center text-xs text-white">{b?.tg ?? '-'}</td>
                    <td className="px-4 py-3 text-center text-xs text-white">{b?.concurrency ?? '-'}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-[#00FFD1] terminal-font">
                      {b?.tsTotal != null ? b.tsTotal.toFixed(1) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-[#9D5CFF] terminal-font">
                      {b?.ttfr != null ? b.ttfr.toFixed(1) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        b?.status === 'completed' ? 'bg-[#39FF14]/10 text-[#39FF14]' :
                        b?.status === 'running' ? 'bg-[#60B5FF]/10 text-[#60B5FF]' :
                        b?.status === 'failed' ? 'bg-[#FF4D6A]/10 text-[#FF4D6A]' :
                        'bg-[#FF9149]/10 text-[#FF9149]'
                      }`}>
                        {b?.status ?? 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(b?.id ?? '')}
                        className="p-1.5 rounded-md text-[#8B8FA3] hover:text-[#FF4D6A] hover:bg-[#FF4D6A]/10 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
