import type { GpuMetrics, SystemMetrics, OllamaStatus } from './types';

// Simulated GPU metrics for demo mode
export function generateGpuMetrics(prev?: GpuMetrics): GpuMetrics {
  const base = prev ?? {
    utilization: 45,
    vramUsed: 8200,
    vramTotal: 16384,
    powerDraw: 120,
    temperature: 62,
    clockSpeed: 1800,
    available: true,
    timestamp: Date.now(),
  };

  return {
    utilization: clamp(base.utilization + randomWalk(5), 10, 98),
    vramUsed: clamp(base.vramUsed + randomWalk(200), 4000, 15000),
    vramTotal: 16384,
    powerDraw: clamp(base.powerDraw + randomWalk(10), 60, 250),
    temperature: clamp(base.temperature + randomWalk(2), 40, 88),
    clockSpeed: clamp(base.clockSpeed + randomWalk(50), 1200, 2400),
    available: true,
    timestamp: Date.now(),
    systemInfo: {
      dgxOs: false,
      dgxOsVersion: null,
      gb10: false,
      unifiedMemory: false,
      unifiedMemoryTotalGB: null,
      nvlinkCount: 0,
      nvSwitchCount: 0,
      gpuName: null,
    },
  };
}

export function generateSystemMetrics(prev?: SystemMetrics): SystemMetrics {
  const base = prev ?? {
    cpuPercent: 25,
    ramUsed: 24,
    ramTotal: 64,
    ramPercent: 37.5,
    timestamp: Date.now(),
  };

  const ramUsed = clamp(base.ramUsed + randomWalk(1), 12, 58);
  return {
    cpuPercent: clamp(base.cpuPercent + randomWalk(8), 5, 95),
    ramUsed: Math.round(ramUsed * 10) / 10,
    ramTotal: 64,
    ramPercent: Math.round((ramUsed / 64) * 1000) / 10,
    timestamp: Date.now(),
  };
}

export const DEMO_OLLAMA_STATUS: OllamaStatus = {
  running: true,
  loadedModel: 'llama3.1:8b-instruct-q4_K_M',
  processor: 'GPU',
  vramUsed: '5.2 GB',
  availableModels: [
    'llama3.1:8b-instruct-q4_K_M',
    'llama3.1:70b-instruct-q4_K_M',
    'mistral:7b-instruct-v0.3-q4_K_M',
    'codellama:13b-instruct-q4_K_M',
    'phi-3:mini-4k-instruct-q4_K_M',
    'gemma2:9b-instruct-q4_K_M',
    'qwen2.5:7b-instruct-q4_K_M',
  ],
};

export const DEMO_LOG_LINES = [
  '[INFO] Starting llama-benchy v0.3.5...',
  '[INFO] Base URL: http://localhost:11434/v1',
  '[INFO] Model: llama3.1:8b-instruct-q4_K_M',
  '[INFO] Parameters: pp=512 tg=128 concurrency=4 runs=3',
  '[INFO] Warming up model...',
  '[INFO] Warm-up complete. Starting benchmark...',
  '',
  '[RUN 1/3] Sending 4 concurrent requests...',
  '  Request 1: 512 prompt tokens, generating 128 tokens...',
  '  Request 2: 512 prompt tokens, generating 128 tokens...',
  '  Request 3: 512 prompt tokens, generating 128 tokens...',
  '  Request 4: 512 prompt tokens, generating 128 tokens...',
  '  Request 1 complete: 42.3 t/s, TTFR: 245ms',
  '  Request 3 complete: 41.8 t/s, TTFR: 251ms',
  '  Request 2 complete: 40.1 t/s, TTFR: 268ms',
  '  Request 4 complete: 39.7 t/s, TTFR: 273ms',
  '[RUN 1/3] Complete - Total: 163.9 t/s, Avg TTFR: 259ms',
  '',
  '[RUN 2/3] Sending 4 concurrent requests...',
  '  Request 1: 512 prompt tokens, generating 128 tokens...',
  '  Request 2: 512 prompt tokens, generating 128 tokens...',
  '  Request 3: 512 prompt tokens, generating 128 tokens...',
  '  Request 4: 512 prompt tokens, generating 128 tokens...',
  '  Request 2 complete: 43.1 t/s, TTFR: 238ms',
  '  Request 1 complete: 42.8 t/s, TTFR: 241ms',
  '  Request 4 complete: 41.2 t/s, TTFR: 256ms',
  '  Request 3 complete: 40.6 t/s, TTFR: 262ms',
  '[RUN 2/3] Complete - Total: 167.7 t/s, Avg TTFR: 249ms',
  '',
  '[RUN 3/3] Sending 4 concurrent requests...',
  '  Request 1 complete: 43.5 t/s, TTFR: 235ms',
  '  Request 3 complete: 42.9 t/s, TTFR: 240ms',
  '  Request 2 complete: 41.4 t/s, TTFR: 254ms',
  '  Request 4 complete: 40.9 t/s, TTFR: 260ms',
  '[RUN 3/3] Complete - Total: 168.7 t/s, Avg TTFR: 247ms',
  '',
  '\u2550\u2550\u2550 BENCHMARK RESULTS \u2550\u2550\u2550',
  '| Metric          | Value    |',
  '|-----------------|----------|',
  '| t/s (total)     | 166.8    |',
  '| t/s (per req)   | 41.7     |',
  '| Peak t/s        | 43.5     |',
  '| TTFR (ms)       | 251.7    |',
  '| est_ppt (ms)    | 18.4     |',
  '',
  '[INFO] Benchmark complete. Results saved.',
];

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val * 10) / 10));
}

function randomWalk(magnitude: number): number {
  return (Math.random() - 0.5) * 2 * magnitude;
}
