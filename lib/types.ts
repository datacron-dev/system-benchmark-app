export interface GpuMetrics {
  utilization: number;
  vramUsed: number;
  vramTotal: number;
  powerDraw: number;
  temperature: number;
  clockSpeed: number;
  available: boolean;
  gpuName?: string | null;
  timestamp: number;
  systemInfo?: {
    dgxOs: boolean;
    dgxOsVersion: string | null;
    gb10: boolean;
    unifiedMemory: boolean;
    unifiedMemoryTotalGB: number | null;
    nvlinkCount: number;
    nvSwitchCount: number;
    gpuName: string | null;
  };
}

export interface SystemMetrics {
  cpuPercent: number;
  ramUsed: number;
  ramTotal: number;
  ramPercent: number;
  cpuModel?: string;
  cpuCores?: number;
  platform?: string;
  arch?: string;
  hostname?: string;
  uptime?: number;
  timestamp: number;
}

export type InferenceServerType = 'ollama' | 'lmstudio';

export interface InferenceServerStatus {
  server: InferenceServerType | null;
  running: boolean;
  loadedModel: string | null;
  processor: string | null;
  vramUsed: string | null;
  availableModels: string[];
}

export interface BenchmarkParams {
  model: string;
  pp: number;
  tg: number;
  concurrency: number;
  runs: number;
}

export interface BenchmarkResult {
  id: string;
  createdAt: string;
  model: string;
  pp: number;
  tg: number;
  concurrency: number;
  runs: number;
  status: string;
  tsTotal: number | null;
  tsReq: number | null;
  peakTs: number | null;
  ttfr: number | null;
  estPpt: number | null;
  duration: number | null;
  logOutput: string | null;
  notes: string | null;
}

export interface LoadPreset {
  name: string;
  label: string;
  pp: number;
  tg: number;
  concurrency: number;
  runs: number;
  description: string;
}

export const LOAD_PRESETS: LoadPreset[] = [
  { name: 'single', label: 'Single User', pp: 512, tg: 128, concurrency: 1, runs: 3, description: 'Single user, standard workload' },
  { name: 'light', label: 'Light Load', pp: 512, tg: 128, concurrency: 4, runs: 3, description: '4 concurrent users, light stress' },
  { name: 'mixed', label: 'Mixed Load', pp: 1024, tg: 256, concurrency: 8, runs: 5, description: '8 concurrent users, heavier prompts' },
  { name: 'stress', label: 'Stress Test', pp: 2048, tg: 512, concurrency: 32, runs: 5, description: '32 concurrent users, maximum stress' },
];
