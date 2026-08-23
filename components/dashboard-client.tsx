'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Cpu, HardDrive, Play, History, Settings, Gauge,
  Server, Zap, Terminal, BarChart3, Download, ChevronLeft, ChevronRight,
  Monitor, BookOpen, Rocket, RefreshCw, Info, Microchip
} from 'lucide-react';
import type {
  GpuMetrics, SystemMetrics, InferenceServerStatus, InferenceServerType, BenchmarkResult, BenchmarkParams,
  InferenceServersStatus, ServerStatusEntry,
} from '@/lib/types';
import { LOAD_PRESETS } from '@/lib/types';
import GpuMonitorPanel from './panels/gpu-monitor-panel';
import InferenceServersPanel from './panels/inference-servers-panel';
import BenchmarkRunnerPanel from './panels/benchmark-runner-panel';
import ResultsPanel from './panels/results-panel';
import SystemStatsPanel from './panels/system-stats-panel';
import HistoryPanel from './panels/history-panel';

type ActivePage = 'dashboard' | 'history' | 'settings';

const NAV_ITEMS: { id: ActivePage; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const DEFAULT_INFERENCE: InferenceServerStatus = {
  server: null,
  running: false,
  loadedModel: null,
  processor: null,
  vramUsed: null,
  availableModels: [],
};

const SERVER_CONFIG: Record<InferenceServerType, { label: string; baseUrl: string; port: number }> = {
  ollama: { label: 'Ollama', baseUrl: 'http://localhost:11434', port: 11434 },
  lmstudio: { label: 'LM Studio', baseUrl: 'http://localhost:1234', port: 1234 },
};

export default function DashboardClient() {
  const [activePage, setActivePage] = useState<ActivePage>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [gpuHistory, setGpuHistory] = useState<GpuMetrics[]>([]);
  const [systemHistory, setSystemHistory] = useState<SystemMetrics[]>([]);
  const [serverType, setServerType] = useState<InferenceServerType | null>(
    (() => {
      if (typeof window === 'undefined') return 'lmstudio';
      const v = localStorage.getItem('benchmark-server');
      return v === 'ollama' || v === 'lmstudio' ? v : 'lmstudio';
    })()
  );
  const [inferenceStatus, setInferenceStatus] = useState<InferenceServerStatus>(DEFAULT_INFERENCE);
  const [inferenceServers, setInferenceServers] = useState<InferenceServersStatus>({ servers: [], availableModels: [] });
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const [benchmarkLog, setBenchmarkLog] = useState<string[]>([]);
  const [currentResult, setCurrentResult] = useState<Partial<BenchmarkResult> | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkResult[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const stopRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Poll live GPU metrics (every 1s)
  useEffect(() => {
    if (!mounted) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch('/api/system/gpu');
        if (res.ok && active) {
          const data = await res.json();
          setGpuHistory(prev => {
            const updated = [...(prev ?? []), data as GpuMetrics];
            return updated.length > 120 ? updated.slice(-120) : updated;
          });
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 1000);
    return () => { active = false; clearInterval(interval); };
  }, [mounted]);

  // Poll live system metrics (every 2s)
  useEffect(() => {
    if (!mounted) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch('/api/system/metrics');
        if (res.ok && active) {
          const data = await res.json();
          setSystemHistory(prev => {
            const updated = [...(prev ?? []), data as SystemMetrics];
            return updated.length > 60 ? updated.slice(-60) : updated;
          });
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => { active = false; clearInterval(interval); };
  }, [mounted]);

  // Poll inference server status (every 5s)
  useEffect(() => {
    if (!mounted) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch('/api/inference/server');
        if (res.ok && active) {
          const data = await res.json();
          // New combined format: { servers: [...], availableModels: [...] }
          if ('servers' in data && Array.isArray(data.servers)) {
            setInferenceServers(data as InferenceServersStatus);
            // Also update legacy single-server status for backward compat
            const primary = data.servers.find((s: ServerStatusEntry) => s.server === (serverType ?? 'ollama'))
              ?? data.servers[0];
            setInferenceStatus({
              server: primary?.server ?? null,
              running: primary?.running ?? false,
              loadedModel: primary?.loadedModel ?? null,
              processor: primary?.processor ?? null,
              vramUsed: primary?.vramUsed ?? null,
              availableModels: data.availableModels ?? [],
            });
          } else {
            // Legacy single-server format
            setInferenceStatus(data as InferenceServerStatus);
          }
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [mounted, serverType]);

  // Fetch benchmarks from API
  const fetchBenchmarks = useCallback(async () => {
    try {
      const res = await fetch('/api/benchmarks?limit=100');
      const data = await res.json();
      setBenchmarks(data?.benchmarks ?? []);
    } catch (e: any) {
      console.error('Failed to fetch benchmarks:', e);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/benchmarks/stats');
      const data = await res.json();
      setStats(data ?? null);
    } catch (e: any) {
      console.error('Failed to fetch stats:', e);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    fetchBenchmarks();
    fetchStats();
  }, [mounted, fetchBenchmarks, fetchStats]);

  // Run benchmark against local inference server
  const handleRunBenchmark = useCallback(async (params: BenchmarkParams) => {
    setBenchmarkRunning(true);
    setBenchmarkLog([]);
    setCurrentResult(null);
    stopRef.current = false;

    try {
      const config = SERVER_CONFIG[serverType ?? 'ollama'];
      const baseUrl = config.baseUrl;

      // Create benchmark entry in DB
      const res = await fetch('/api/benchmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, status: 'running', serverType: serverType ?? 'lmstudio' }),
      });
      const created = await res.json();

      const logLines: string[] = [];
      const addLog = (line: string) => {
        logLines.push(line);
        setBenchmarkLog(prev => [...(prev ?? []), line]);
      };

      addLog(`[INFO] Starting benchmark...`);
      addLog(`[INFO] Model: ${params?.model ?? 'unknown'}`);
      addLog(`[INFO] Parameters: pp=${params?.pp ?? 512} tg=${params?.tg ?? 128} concurrency=${params?.concurrency ?? 1} runs=${params?.runs ?? 3}`);
      addLog(`[INFO] Target: ${baseUrl}`);
      addLog('');

      // Check if inference server is available
      let serverAvailable = false;
      try {
        if (serverType === 'lmstudio') {
          // Probe OpenAI-compatible endpoint via a lightweight test request
          const probeRes = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: '',
              messages: [{ role: 'user', content: '.' }],
              max_tokens: 1,
              stream: false,
            }),
            signal: AbortSignal.timeout(3000),
          });
          serverAvailable = probeRes.ok;
        } else {
          const check = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
          serverAvailable = check.ok;
        }
      } catch {}

      if (!serverAvailable) {
        addLog(`[WARN] ${config.label} is not running at ${baseUrl}`);
        addLog('[INFO] Running simulated benchmark for demonstration...');
        addLog('');
      } else if (serverType === 'lmstudio') {
        addLog(`[INFO] Using LM Studio OpenAI-compatible API at ${baseUrl}`);
        addLog(`[INFO] Endpoint: POST ${baseUrl}/v1/chat/completions`);
      }
      addLog('');

      // ── Startup sanity check: send a single test request ──
      if (serverAvailable && serverType === 'lmstudio') {
        addLog('[INFO] Running startup sanity check...');
        try {
          const sanityReqStart = Date.now();
          const sanityResp = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: params.model,
              messages: [{ role: 'user', content: 'Say hello.' }],
              max_tokens: 5,
            }),
          });

          const sanityBody = await sanityResp.json();
          addLog(`[SANITY] Raw response: ${JSON.stringify(sanityBody).substring(0, 500)}`);

          const sanityUsage = sanityBody?.usage ?? {};
          const sanityCompletionTokens = sanityUsage?.completion_tokens ?? 0;
          const sanityPromptTokens = sanityUsage?.prompt_tokens ?? 0;

          if (sanityCompletionTokens <= 1) {
            throw new Error('LM Studio returned <=1 completion token. Check endpoint, model, and max_tokens.');
          }
          addLog(`[SANITY] completion_tokens=${sanityCompletionTokens} => OK`);

          if (sanityPromptTokens === 0) {
            throw new Error('LM Studio returned 0 prompt tokens. The messages array may be empty or malformed.');
          }
          addLog(`[SANITY] prompt_tokens=${sanityPromptTokens} => OK`);
          addLog('');
        } catch (se: any) {
          addLog(`[SANITY] FAILED: ${se?.message ?? 'Unknown error'}`);
          addLog('[INFO] Aborting benchmark due to sanity check failure.');
          addLog('');
          await fetch(`/api/benchmarks/${created?.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'failed', logOutput: logLines.join('\n') }),
          });
          setBenchmarkRunning(false);
          await fetchBenchmarks();
          await fetchStats();
          return;
        }
      }

      // Per-request metrics: full data for accurate aggregation
      const allRequestMetrics: Array<{
        requestStart: number;
        requestEnd: number;
        completionTokens: number;
        promptTokens: number;
        ttfrSec: number | null;
        generationSec: number | null;
        totalLatencySec: number;
        reqTps: number | null;
        e2eTps: number;
      }> = [];
      const startTime = Date.now();

      // Per-run timing: track wallSec and tsTotal for EACH run separately
      let runWallSec = 0;
      const perRunTsTotal: number[] = [];

      for (let runIdx = 0; runIdx < (params?.runs ?? 3); runIdx++) {
        if (stopRef.current) {
          addLog('[INFO] Benchmark stopped by user.');
          break;
        }

        addLog(`[RUN ${runIdx + 1}/${params?.runs ?? 3}] Sending ${params?.concurrency ?? 1} concurrent requests...`);

        if (serverAvailable) {
          // Record run start BEFORE dispatching concurrent requests
          const runStart = Date.now();

          const promises = Array.from({ length: params?.concurrency ?? 1 }, async (_, cIdx) => {
            const reqStart = Date.now();
            let completionTokens = 0;
            let promptTokens = 0;
            let ttfrSec: number | null = null;
            let generationSec: number | null = null;
            let totalLatencySec = 0;
            let reqTps: number | null = null;
            let e2eTps = 0;

            try {
              if (serverType === 'lmstudio') {
                const prompt = 'Write a detailed explanation of how neural networks work, including backpropagation, gradient descent, and activation functions. '.repeat(Math.max(1, Math.floor((params?.pp ?? 512) / 20)));

                // ── LM Studio OpenAI-compatible (POST /v1/chat/completions on localhost:1234) ──
                // Check for server-side stats (LM Studio injects response.stats when available)
                const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    model: params.model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: params?.tg ?? 128,
                    temperature: 0.7,
                  }),
                });

                const data = await resp.json();
                const usage = data?.usage ?? {};
                const stats = data?.stats ?? {};
                const reqEnd = Date.now();

                // completionTokens: usage.completion_tokens (actual generated, NOT requested max_tokens)
                completionTokens = usage?.completion_tokens ?? 0;
                if (completionTokens === 0) {
                  const generated = data?.choices?.[0]?.message?.reasoning_content
                    ?? data?.choices?.[0]?.message?.content
                    ?? data?.choices?.[0]?.text
                    ?? '';
                  completionTokens = generated.trim().length > 0 ? Math.max(1, Math.round(generated.length / 4)) : 1;
                }
                promptTokens = usage?.prompt_tokens ?? 0;

                // TTFR: prefer response.stats.time_to_first_token (seconds), null if unavailable
                ttfrSec = (stats?.time_to_first_token && stats.time_to_first_token > 0)
                  ? stats.time_to_first_token
                  : null;

                // Generation time: prefer response.stats.generation_time (seconds), wall-clock fallback
                totalLatencySec = (reqEnd - reqStart) / 1000;
                generationSec = (stats?.generation_time && stats.generation_time > 0)
                  ? stats.generation_time
                  : (totalLatencySec > 0 ? totalLatencySec : null);

                // reqTps: prefer stats.tokens_per_second, fallback to completionTokens/generationSec
                if (stats?.tokens_per_second && stats.tokens_per_second > 0) {
                  reqTps = stats.tokens_per_second;
                } else if (generationSec && generationSec > 0) {
                  reqTps = Math.round((completionTokens / generationSec) * 10) / 10;
                }
                e2eTps = totalLatencySec > 0 ? Math.round((completionTokens / totalLatencySec) * 10) / 10 : 0;

                // Validation logging
                addLog(`  [VALIDATE] completionTokens=${completionTokens} (source: usage.completion_tokens${completionTokens === (params?.tg ?? 128) ? ' [WARN: equals requested tg!]' : ''})`);
                addLog(`  [VALIDATE] promptTokens=${promptTokens} (source: usage.prompt_tokens)`);
                addLog(`  [VALIDATE] TTFR=${ttfrSec ? ttfrSec.toFixed(3) + 's (from server stats)' : 'N/A (unavailable)'}`);
                addLog(`  [VALIDATE] generationSec=${generationSec ? generationSec.toFixed(3) + 's' + (stats?.generation_time ? ' (from server stats)' : ' (wall-clock-e2e)') : 'N/A'}`);
                addLog(`  [VALIDATE] reqTps=${reqTps ? reqTps.toFixed(1) + ' t/s' : 'N/A'} (formula: ${stats?.tokens_per_second ? 'server tokens_per_second' : generationSec ? 'completionTokens/generationSec' : 'no data'})`);
              } else {
                // ── Ollama: streaming /api/generate for accurate server-side timing ──
                const resp = await fetch(`${baseUrl}/api/generate`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    model: params.model,
                    prompt: 'Write a detailed explanation of how neural networks work, including backpropagation, gradient descent, and activation functions. '.repeat(Math.max(1, Math.floor((params?.pp ?? 512) / 20))),
                    stream: true,
                    options: {
                      num_predict: params?.tg ?? 128,
                    },
                  }),
                });

                const reader = resp.body?.getReader();
                const decoder = new TextDecoder();
                let accumulated = '';
                let ttfrFirstChunk = 0;
                let totalEvalCount = 0;
                let totalEvalDurationNs = 0;
                let totalPromptEvalCount = 0;
                let fullResponse = '';
                let doneChunk = false;

                if (reader) {
                  while (true) {
                    const { done: streamDone, value } = await reader.read();
                    if (streamDone) break;

                    accumulated += decoder.decode(value, { stream: true });
                    const lines = accumulated.split('\n');
                    accumulated = lines.pop() ?? '';

                    for (const line of lines) {
                      const trimmed = line.trim();
                      if (!trimmed || !trimmed.startsWith('{')) continue;

                      try {
                        const chunk = JSON.parse(trimmed);

                        // First chunk: prompt_eval_duration as TTFR proxy (nanoseconds -> seconds)
                        if (!ttfrFirstChunk && chunk?.prompt_eval_duration) {
                          ttfrFirstChunk = chunk.prompt_eval_duration / 1e9;
                          totalPromptEvalCount = chunk?.prompt_eval_count ?? 0;
                        }

                        // Accumulate per-token generation stats
                        totalEvalCount += chunk?.eval_count ?? 0;
                        totalEvalDurationNs += chunk?.eval_duration ?? 0;

                        // Accumulate generated text
                        fullResponse += chunk?.response ?? '';

                        // Detect final chunk for fallback totals
                        if (chunk?.done === true) {
                          doneChunk = true;
                          if (totalEvalCount === 0) {
                            totalEvalCount = chunk?.eval_count ?? 0;
                            totalEvalDurationNs = chunk?.eval_duration ?? 0;
                          }
                        }
                      } catch {
                        // Skip malformed JSON chunks
                      }
                    }
                  }
                }

                // outputTokens: server-reported eval_count (actual generated, NOT requested tg)
                completionTokens = totalEvalCount;
                if (completionTokens === 0) {
                  completionTokens = fullResponse.trim().length > 0
                    ? Math.max(1, Math.round(fullResponse.length / 4))
                    : 1;
                }
                promptTokens = totalPromptEvalCount;

                // TTFR: prompt_eval_duration from first chunk (ns -> seconds)
                ttfrSec = ttfrFirstChunk > 0 ? ttfrFirstChunk : null;

                // Generation time: wall-clock from first token to request end
                // Fallback to eval_duration sum if available
                const reqEnd = Date.now();
                totalLatencySec = Math.max((reqEnd - reqStart) / 1000, 0.001);

                let genFromStats = totalEvalDurationNs > 0;
                if (genFromStats) {
                  generationSec = totalEvalDurationNs / 1e9;
                } else if (ttfrSec && ttfrSec > 0 && totalLatencySec > ttfrSec) {
                  generationSec = totalLatencySec - ttfrSec;
                } else {
                  generationSec = totalLatencySec;
                }

                // tsReq: completionTokens / generationSec (never from TTFR)
                if (generationSec > 0) {
                  reqTps = Math.round((completionTokens / generationSec) * 10) / 10;
                }

                // e2eTps
                e2eTps = totalLatencySec > 0 ? Math.round((completionTokens / totalLatencySec) * 10) / 10 : 0;

                // Validation logging
                addLog(`  [VALIDATE] completionTokens=${completionTokens} (source: eval_count${completionTokens === (params?.tg ?? 128) ? ' [WARN: equals requested tg!]' : ''})`);
                addLog(`  [VALIDATE] promptTokens=${promptTokens} (source: prompt_eval_count)`);
                addLog(`  [VALIDATE] TTFR=${ttfrSec ? ttfrSec.toFixed(3) + 's (from streaming first chunk)' : 'N/A (unavailable)'}`);
                addLog(`  [VALIDATE] generationSec=${generationSec ? generationSec.toFixed(3) + 's (' + (genFromStats ? 'eval_duration sum' : 'wall-clock') + ')' : 'N/A (unavailable)'}`);
                addLog(`  [VALIDATE] reqTps=${reqTps ? reqTps.toFixed(1) + ' t/s' : 'N/A'} (formula: completionTokens/generationSec)`);
              }

              const reqEnd = Date.now();

              allRequestMetrics.push({
                requestStart: reqStart,
                requestEnd: reqEnd,
                completionTokens,
                promptTokens,
                ttfrSec,
                generationSec,
                totalLatencySec,
                reqTps,
                e2eTps,
              });

              const tsDisplay = reqTps ?? e2eTps;
              const ttfrDisplay = ttfrSec ? Math.round(ttfrSec * 1000 * 10) / 10 : null;
              addLog(`  Request ${cIdx + 1} complete: ${reqTps ? reqTps.toFixed(1) + ' t/s' : 'N/A'}, TTFR: ${ttfrDisplay ?? 'N/A'}, tokens: ${completionTokens}`);
              return { ts: tsDisplay, ttfr: ttfrDisplay, tokens: completionTokens };
            } catch (e: any) {
              addLog(`  Request ${cIdx + 1} failed: ${e?.message ?? 'Unknown error'}`);
              return { ts: 0, ttfr: 0, tokens: 0 };
            }
          });

          const results = await Promise.all(promises);
          const runEnd = Date.now();
          runWallSec = (runEnd - runStart) / 1000;
          const runTokens = results.reduce((sum, r) => sum + r.tokens, 0);
          const runTsTotal = runWallSec > 0 ? Math.round((runTokens / runWallSec) * 10) / 10 : 0;
          perRunTsTotal.push(runTsTotal);
          addLog(`[RUN ${runIdx + 1}/${params?.runs ?? 3}] Complete - ${runTokens} tokens, wall=${runWallSec.toFixed(2)}s, t/s(total)=${runTsTotal}`);
        } else {
          // Simulated benchmark — concurrent requests with artificial delay
          const simPromises = Array.from({ length: params?.concurrency ?? 1 }, async (_, cIdx) => {
            const reqStart = Date.now();
            await new Promise(r => setTimeout(r, 100 + Math.random() * 400));
            const reqEnd = Date.now();
            const wallMs = Math.max(reqEnd - reqStart, 1);
            const ts = 25 + Math.random() * 25;
            const ttfr = 180 + Math.random() * 150;
            const tokens = Math.max(1, Math.round(ts * (wallMs / 1000)));
            const genSec = tokens / ts;
            const ttfrSec = ttfr / 1000;
            allRequestMetrics.push({
              requestStart: reqStart,
              requestEnd: reqEnd,
              completionTokens: tokens,
              promptTokens: Math.max(1, Math.round(tokens * 2)),
              ttfrSec,
              generationSec: genSec,
              totalLatencySec: wallMs / 1000,
              reqTps: ts,
              e2eTps: ts,
            });
            addLog(`  Request ${cIdx + 1} complete: ${ts.toFixed(1)} t/s, TTFR: ${ttfr.toFixed(0)}ms`);
            return { tokens };
          });
          const simResults = await Promise.all(simPromises);
          runWallSec = Math.max(allRequestMetrics.slice(-1 * (params?.concurrency ?? 1)).reduce((s, m) => Math.max(s, m.requestEnd) - Math.min(s, m.requestStart), 0) / 1000, 0.001);
          const simTokens = simResults.reduce((s, r) => s + r.tokens, 0);
          const simTsTotal = runWallSec > 0 ? Math.round((simTokens / runWallSec) * 10) / 10 : 0;
          perRunTsTotal.push(simTsTotal);
          addLog(`[RUN ${runIdx + 1}/${params?.runs ?? 3}] Complete - ${simTokens} tokens, wall=${runWallSec.toFixed(2)}s, t/s(total)=${simTsTotal}`);
        }
        addLog('');
      }

      // Run-level validation: warn if completionTokens equals requested tg for every request
      const requestedTg = params?.tg ?? 128;
      const allMatchTg = allRequestMetrics.length > 0 && allRequestMetrics.every(m => m.completionTokens === requestedTg);
      if (allMatchTg) {
        addLog(`[WARN] Output token count equals requested tg (${requestedTg}) for every request. ` +
          `Verify the server is reporting actual generated tokens, not the max_tokens limit.`);
      }

      if (stopRef.current) {
        await fetch(`/api/benchmarks/${created?.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'stopped', logOutput: logLines.join('\n') }),
        });
        setBenchmarkRunning(false);
        await fetchBenchmarks();
        await fetchStats();
        return;
      }

      const wallDuration = Math.max((Date.now() - startTime) / 1000, 0.001);

      // Aggregate from allRequestMetrics
      const totalCompletionTokens = allRequestMetrics.reduce((s, m) => s + m.completionTokens, 0);
      const totalPromptTokens = allRequestMetrics.reduce((s, m) => s + m.promptTokens, 0);

      // tsTotal: mean of per-run throughput values (each run's tokens / run's wall time)
      const tsTotal = perRunTsTotal.length > 0
        ? Math.round((perRunTsTotal.reduce((s, v) => s + v, 0) / perRunTsTotal.length) * 10) / 10
        : 0;

      // tsReq: average per-request t/s (only requests with known reqTps)
      const requestsWithReqTps = allRequestMetrics.filter(m => m.reqTps != null && m.reqTps > 0);
      const tsReq = requestsWithReqTps.length > 0
        ? Math.round((requestsWithReqTps.reduce((s, m) => s + m.reqTps!, 0) / requestsWithReqTps.length) * 10) / 10
        : null;

      // peakTs: highest single-request t/s
      const peakTs = requestsWithReqTps.length > 0
        ? Math.round(Math.max(...requestsWithReqTps.map(m => m.reqTps!)) * 10) / 10
        : null;

      // TTFR: average time to first token across all requests (ms)
      const requestsWithTtfr = allRequestMetrics.filter(m => m.ttfrSec != null && m.ttfrSec > 0);
      const ttfrAvg = requestsWithTtfr.length > 0
        ? Math.round((requestsWithTtfr.reduce((s, m) => s + m.ttfrSec! * 1000, 0) / requestsWithTtfr.length) * 10) / 10
        : null;

      // approx_prompt_ms_per_token: TTFR / promptTokens * 1000 (ms per prompt token)
      const approxPromptMsPerToken = (requestsWithTtfr.length > 0 && totalPromptTokens > 0)
        ? Math.round((requestsWithTtfr.reduce((s, m) => s + m.ttfrSec!, 0) / requestsWithTtfr.length * 1000 / totalPromptTokens) * 10) / 10
        : null;

      addLog('\u2550\u2550\u2550 BENCHMARK RESULTS \u2550\u2550\u2550');
      addLog(`| t/s (total)     | ${tsTotal} |`);
      addLog(`| t/s (req)       | ${tsReq} |`);
      addLog(`| Peak t/s        | ${peakTs} |`);
      addLog(`| TTFR (ms)       | ${ttfrAvg} |`);
      addLog(`| approx_ppt (ms) | ${approxPromptMsPerToken} |`);
      addLog('');
      addLog('[INFO] Benchmark complete. Results saved.');

      const result = { tsTotal, tsReq, peakTs, ttfr: ttfrAvg, estPpt: approxPromptMsPerToken, duration: wallDuration };

      setCurrentResult({
        ...created,
        ...result,
        status: 'completed',
        logOutput: logLines.join('\n'),
      });

      // Update in DB
      await fetch(`/api/benchmarks/${created?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tsTotal,
          tsReq,
          peakTs,
          ttfr: ttfrAvg,
          estPpt: approxPromptMsPerToken,
          duration: wallDuration,
          status: 'completed',
          logOutput: logLines.join('\n'),
        }),
      });

      await fetchBenchmarks();
      await fetchStats();
    } catch (e: any) {
      console.error('Benchmark error:', e);
      setBenchmarkLog(prev => [...(prev ?? []), `[ERROR] ${e?.message ?? 'Unknown error'}`]);
    } finally {
      setBenchmarkRunning(false);
    }
  }, [fetchBenchmarks, fetchStats, serverType]);

  const handleStopBenchmark = useCallback(() => {
    stopRef.current = true;
    setBenchmarkRunning(false);
    setBenchmarkLog(prev => [...(prev ?? []), '[INFO] Benchmark stopped by user.']);
  }, []);

  const handleSetServerType = useCallback((type: InferenceServerType) => {
    setServerType(type);
    localStorage.setItem('benchmark-server', type ?? 'ollama');
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0D0E1A]">
        <div className="flex flex-col items-center gap-4">
          <Zap className="w-12 h-12 text-[#00FFD1] animate-pulse" />
          <p className="text-[#8B8FA3] terminal-font">Initializing System Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0D0E1A]">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full z-50 transition-all duration-300 flex flex-col ${
          sidebarCollapsed ? 'w-[68px]' : 'w-[220px]'
        } bg-[#0F1020] border-r border-[#2A2D45]`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-[#2A2D45]">
          <Zap className="w-7 h-7 text-[#00FFD1] flex-shrink-0" />
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <h1 className="text-base font-bold text-white tracking-wide">System Bench</h1>
              <p className="text-[11px] text-[#8B8FA3] tracking-wider uppercase">Benchmark</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {NAV_ITEMS.map(item => {
            const Icon = item?.icon;
            const isActive = activePage === item?.id;
            return (
              <button
                key={item?.id}
                onClick={() => setActivePage(item?.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-[#00FFD1]/10 text-[#00FFD1]'
                    : 'text-[#8B8FA3] hover:bg-[#1A1C30] hover:text-white'
                }`}
              >
                {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
                {!sidebarCollapsed && <span>{item?.label ?? ''}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse button */}
        <button
          onClick={() => setSidebarCollapsed(prev => !prev)}
          className="flex items-center justify-center h-12 border-t border-[#2A2D45] text-[#8B8FA3] hover:text-white transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 transition-all duration-300 ${
          sidebarCollapsed ? 'ml-[68px]' : 'ml-[220px]'
        }`}
      >
        {/* Header */}
        <header className="sticky top-0 z-40 h-14 bg-[#0D0E1A]/90 backdrop-blur-md border-b border-[#2A2D45] flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-white capitalize">{activePage ?? 'Dashboard'}</h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#00FFD1]/20 text-[#00FFD1] uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FFD1] animate-pulse" />
              Live
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/api/benchmarks/export/csv"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1A1C30] text-[#8B8FA3] hover:text-white hover:bg-[#2A2D45] text-xs transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </a>
            <a
              href="/api/benchmarks/export/pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1A1C30] text-[#8B8FA3] hover:text-white hover:bg-[#2A2D45] text-xs transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              PDF
            </a>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 md:p-6">
          <AnimatePresence mode="wait">
            {activePage === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <DashboardPage
                  gpuHistory={gpuHistory}
                  systemHistory={systemHistory}
                  inferenceStatus={inferenceStatus}
                  inferenceServers={inferenceServers}
                  benchmarkRunning={benchmarkRunning}
                  benchmarkLog={benchmarkLog}
                  currentResult={currentResult}
                  onRunBenchmark={handleRunBenchmark}
                  onStopBenchmark={handleStopBenchmark}
                  stats={stats}
                />
              </motion.div>
            )}
            {activePage === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <HistoryPanel benchmarks={benchmarks} onRefresh={fetchBenchmarks} />
              </motion.div>
            )}
            {activePage === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <SettingsPage
                  systemHistory={systemHistory}
                  gpuHistory={gpuHistory}
                  serverType={serverType}
                  onSetServerType={handleSetServerType}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// Dashboard page assembles the 6 panels
function DashboardPage({
  gpuHistory, systemHistory, inferenceStatus, inferenceServers, benchmarkRunning,
  benchmarkLog, currentResult, onRunBenchmark, onStopBenchmark, stats
}: {
  gpuHistory: GpuMetrics[];
  systemHistory: SystemMetrics[];
  inferenceStatus: InferenceServerStatus;
  inferenceServers: InferenceServersStatus;
  benchmarkRunning: boolean;
  benchmarkLog: string[];
  currentResult: Partial<BenchmarkResult> | null;
  onRunBenchmark: (params: BenchmarkParams) => void;
  onStopBenchmark: () => void;
  stats: any;
}) {
  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={BarChart3} label="Total Runs" value={stats?.total ?? 0} color="#00FFD1" />
        <StatCard icon={Gauge} label="Avg t/s" value={stats?.avgTsTotal ?? 0} color="#60B5FF" suffix=" t/s" />
        <StatCard icon={Zap} label="Best Peak" value={stats?.bestPeakTs ?? 0} color="#FF9149" suffix=" t/s" />
        <StatCard icon={Activity} label="Avg TTFR" value={stats?.avgTtfr ?? 0} color="#9D5CFF" suffix=" ms" />
      </div>

      {/* Row 1: GPU + System + Inference Server */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <GpuMonitorPanel history={gpuHistory} />
        </div>
        <div className="space-y-4">
          <SystemStatsPanel history={systemHistory} />
          <InferenceServersPanel servers={inferenceServers.servers} />
        </div>
      </div>

      {/* Row 2: Benchmark Runner + Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BenchmarkRunnerPanel
          models={inferenceServers?.availableModels ?? inferenceStatus?.availableModels ?? []}
          running={benchmarkRunning}
          logLines={benchmarkLog}
          onRun={onRunBenchmark}
          onStop={onStopBenchmark}
        />
        <ResultsPanel result={currentResult} />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, suffix }: {
  icon: React.ElementType; label: string; value: number; color: string; suffix?: string;
}) {
  return (
    <div className="bg-[#141526] rounded-xl p-4 border border-[#2A2D45] hover:border-[#3A3D55] transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-xs text-[#8B8FA3]">{label ?? ''}</span>
      </div>
      <p className="text-2xl font-bold text-white terminal-font">
        {typeof value === 'number' && !isNaN(value) ? value.toLocaleString() : '0'}{suffix ?? ''}
      </p>
    </div>
  );
}

function SettingsPage({
  systemHistory, gpuHistory, serverType, onSetServerType
}: {
  systemHistory: SystemMetrics[];
  gpuHistory: GpuMetrics[];
  serverType: InferenceServerType | null;
  onSetServerType: (type: InferenceServerType) => void;
}) {
  const latest = systemHistory?.[systemHistory.length - 1];
  const latestGpu = gpuHistory?.[gpuHistory.length - 1];
  const sysInfo = latestGpu?.systemInfo;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Inference Server Settings */}
      <div className="bg-[#141526] rounded-xl p-6 border border-[#2A2D45]">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-[#9D5CFF]" />
          Inference Server
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-[#8B8FA3] mb-2 block">Server Type</label>
            <div className="flex gap-2">
              {(['ollama', 'lmstudio'] as const).map((type) => {
                const cfg = SERVER_CONFIG[type];
                const isActive = serverType === type;
                return (
                  <button
                    key={type}
                    onClick={() => onSetServerType(type)}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                      isActive
                        ? 'bg-[#00FFD1]/10 text-[#00FFD1] border-[#00FFD1]/30'
                        : 'bg-[#0D0E1A] text-[#8B8FA3] border-[#2A2D45] hover:border-[#00FFD1]'
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <SettingRow label="Server Port" value={`${SERVER_CONFIG[serverType ?? 'ollama'].port}`} />
        </div>
      </div>

      {/* Connection Settings */}
      <div className="bg-[#141526] rounded-xl p-6 border border-[#2A2D45]">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-[#00FFD1]" />
          Connection Settings
        </h3>
        <div className="space-y-4">
          <SettingRow label="Dashboard Port" value="8585" />
          <SettingRow label="GPU Polling Interval" value="1000ms" />
          <SettingRow label="System Polling Interval" value="2000ms" />
          <SettingRow label="Inference Server Polling Interval" value="5000ms" />
        </div>
      </div>

      {/* Detected Hardware */}
      <div className="bg-[#141526] rounded-xl p-6 border border-[#2A2D45]">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Monitor className="w-5 h-5 text-[#60B5FF]" />
          Detected Hardware
        </h3>
        <div className="space-y-4">
          <SettingRow label="CPU" value={latest?.cpuModel ?? 'Detecting...'} />
          <SettingRow label="CPU Cores" value={latest?.cpuCores ? `${latest.cpuCores} cores` : 'Detecting...'} />
          <SettingRow label="RAM" value={latest?.ramTotal ? `${latest.ramTotal} GB` : 'Detecting...'} />
          <SettingRow label="Platform" value={latest?.platform ?? 'Detecting...'} />
          <SettingRow label="Architecture" value={latest?.arch ?? 'Detecting...'} />
          <SettingRow label="Hostname" value={latest?.hostname ?? 'Detecting...'} />
          {latest?.uptime != null && (
            <SettingRow label="System Uptime" value={formatUptime(latest.uptime)} />
          )}
        </div>
      </div>

      {/* GPU & Accelerator Info */}
      <div className="bg-[#141526] rounded-xl p-6 border border-[#2A2D45]">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Microchip className="w-5 h-5 text-[#00FFD1]" />
          GPU & Accelerator
        </h3>
        <div className="space-y-4">
          <SettingRow label="GPU Model" value={latestGpu?.gpuName ?? sysInfo?.gpuName ?? 'Detecting...'} />
          <SettingRow label="VRAM Total" value={latestGpu?.vramTotal ? `${Math.round(latestGpu.vramTotal / 1024)} GB` : 'Detecting...'} />
          <SettingRow label="VRAM Used" value={latestGpu?.vramUsed ? `${(latestGpu.vramUsed / 1024).toFixed(1)} GB` : 'Detecting...'} />
          {sysInfo?.gb10 && (
            <SettingRow label="Architecture" value="GB10 Grace Blackwell (Unified Memory)" />
          )}
          {sysInfo?.unifiedMemory && sysInfo?.unifiedMemoryTotalGB && (
            <SettingRow label="Unified Memory (GOU + CPU)" value={`${sysInfo.unifiedMemoryTotalGB} GB`} />
          )}
          {sysInfo?.dgxOs && (
            <SettingRow label="OS" value={sysInfo.dgxOsVersion ?? 'DGX OS'} />
          )}
          {(sysInfo?.nvlinkCount ?? 0) > 0 && (
            <SettingRow label="NVLink Active" value={`${sysInfo!.nvlinkCount} links`} />
          )}
          {(sysInfo?.nvSwitchCount ?? 0) > 0 && (
            <SettingRow label="NVSwitch" value={`${sysInfo!.nvSwitchCount} switches`} />
          )}
        </div>
      </div>

      {/* Installation */}
      <div className="bg-[#141526] rounded-xl p-6 border border-[#2A2D45]">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Rocket className="w-5 h-5 text-[#FF9149]" />
          Quick Install
        </h3>
        <p className="text-sm text-[#8B8FA3] mb-3">
          One-line installer that clones the repo, sets up Node.js, installs dependencies, configures Prisma, creates a desktop launcher, and auto-starts the app.
        </p>
        <CodeBlock lines={[
          '# One-line install (or update)',
          'curl -fsSL https://raw.githubusercontent.com/datacron-dev/system-benchmark-app/main/scripts/install.sh | bash',
        ]} />
        <p className="text-xs text-[#555570] mt-3">
          This will install to <code className="text-[#8B8FA3]">~/system-benchmark-app</code>. Re-run to update to the latest version.
        </p>
      </div>

      {/* Start / Launch */}
      <div className="bg-[#141526] rounded-xl p-6 border border-[#2A2D45]">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Play className="w-5 h-5 text-[#00FFD1]" />
          Start the Dashboard
        </h3>
        <CodeBlock lines={[
          '# Using the start script',
          './scripts/start.sh',
          '',
          '# Or directly with npm',
          'npm run dev      # Development mode (port 8585)',
          'npm run start    # Production mode (port 8585, after npm run build)',
        ]} />
        <p className="text-xs text-[#555570] mt-3">
          The start script auto-detects whether to use production or dev mode based on whether a <code className="text-[#8B8FA3]">.next</code> build folder exists.
        </p>
      </div>

      {/* Update */}
      <div className="bg-[#141526] rounded-xl p-6 border border-[#2A2D45]">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-[#9D5CFF]" />
          Update
        </h3>
        <p className="text-sm text-[#8B8FA3] mb-3">
          Re-run the installer to force-update to the latest version. This will reset the repository to the latest <code className="text-[#00FFD1]">main</code> branch and reinstall dependencies.
        </p>
        <CodeBlock lines={[
          'curl -fsSL https://raw.githubusercontent.com/datacron-dev/system-benchmark-app/main/scripts/install.sh | bash',
        ]} />
      </div>

      {/* Requirements */}
      <div className="bg-[#141526] rounded-xl p-6 border border-[#2A2D45]">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-[#60B5FF]" />
          Requirements
        </h3>
        <div className="space-y-2 text-sm">
          <RequirementRow name="Node.js 18+" required desc="Auto-installed by installer via nvm" />
          <RequirementRow name="npm 9+" required desc="Bundled with Node.js" />
          <RequirementRow name="Ollama or LM Studio" desc="For running LLM benchmarks locally" />
          <RequirementRow name="NVIDIA GPU + drivers" desc="For GPU metrics via nvidia-smi" />
          <RequirementRow name="SQLite" desc="Default database — zero config, auto-created" />
        </div>
      </div>

      {/* Desktop Launcher */}
      <div className="bg-[#141526] rounded-xl p-6 border border-[#2A2D45]">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Monitor className="w-5 h-5 text-[#FF4D6A]" />
          Desktop Launcher
        </h3>
        <p className="text-sm text-[#8B8FA3]">
          After installation, a <strong className="text-white">System Benchmark</strong> desktop shortcut is created automatically at{' '}
          <code className="text-[#00FFD1]">~/Desktop/System_Benchmark.desktop</code>. Click it to launch the app and open your browser.
          To recreate the shortcut, re-run the installer.
        </p>
      </div>
    </div>
  );
}

function CodeBlock({ lines }: { lines: string[] }) {
  return (
    <div className="bg-[#0D0E1A] rounded-lg p-4 terminal-font text-xs overflow-x-auto">
      {lines.map((line, i) => (
        <p key={i} className={line.startsWith('#') ? 'text-[#555570]' : line === '' ? 'h-2' : 'text-[#00FFD1]'}>
          {line || '\u00A0'}
        </p>
      ))}
    </div>
  );
}

function RequirementRow({ name, required, desc }: { name: string; required?: boolean; desc?: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-[#2A2D45] last:border-0">
      <span className={`text-xs px-1.5 py-0.5 rounded ${required ? 'bg-[#00FFD1]/10 text-[#00FFD1]' : 'bg-[#FF9149]/10 text-[#FF9149]'}`}>
        {required ? 'Required' : 'Optional'}
      </span>
      <span className="text-sm text-white font-medium">{name}</span>
      {desc && <span className="text-xs text-[#8B8FA3] ml-auto">{desc}</span>}
    </div>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#2A2D45] last:border-0">
      <span className="text-sm text-[#8B8FA3]">{label ?? ''}</span>
      <span className="text-sm text-white terminal-font max-w-[60%] text-right truncate">{value ?? ''}</span>
    </div>
  );
}
