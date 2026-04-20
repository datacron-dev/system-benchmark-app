import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface ServerInfo {
  server: 'ollama' | 'lmstudio' | null;
  running: boolean;
  loadedModel: string | null;
  processor: string | null;
  vramUsed: string | null;
  availableModels: string[];
}

async function probeOllama(): Promise<ServerInfo | null> {
  try {
    const tagsRes = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    if (!tagsRes.ok) return null;
    const tagsData = await tagsRes.json();
    const models = tagsData?.models?.map((m: any) => m?.name).filter(Boolean) || [];

    const psRes = await fetch('http://localhost:11434/api/ps', { signal: AbortSignal.timeout(2000) });
    let loadedModel: string | null = null;
    let processor: string | null = null;
    let vramUsed: string | null = null;

    if (psRes.ok) {
      const psData = await psRes.json();
      if (psData?.models?.length > 0) {
        const running = psData.models[0];
        loadedModel = running?.name ?? null;
        const sizeVram = running?.size_vram ?? 0;
        const size = running?.size ?? 0;
        if (sizeVram > 0 && size > 0) {
          const gpuPct = Math.round((sizeVram / size) * 100);
          processor = gpuPct > 90 ? 'GPU' : gpuPct > 10 ? `GPU/CPU (${gpuPct}% GPU)` : 'CPU';
          vramUsed = `${(sizeVram / (1024 ** 3)).toFixed(1)} GB`;
        } else {
          processor = 'CPU';
        }
      }
    }

    return {
      server: 'ollama',
      running: models.length > 0 || loadedModel !== null,
      loadedModel,
      processor,
      vramUsed,
      availableModels: models,
    };
  } catch {
    return null;
  }
}

async function probeLmStudio(): Promise<ServerInfo | null> {
  try {
    const tagsRes = await fetch('http://localhost:1234/api/tags', { signal: AbortSignal.timeout(2000) });
    if (!tagsRes.ok) return null;
    const tagsData = await tagsRes.json();
    const models = tagsData?.models?.map((m: any) => m?.name).filter(Boolean) || [];

    // LM Studio doesn't have an /api/ps endpoint, so we check if any model is loaded
    // by checking /api/running-models (newer versions) or just report models available
    let loadedModel: string | null = null;
    try {
      const runningRes = await fetch('http://localhost:1234/api/running-models', { signal: AbortSignal.timeout(1000) });
      if (runningRes.ok) {
        const runningData = await runningRes.json();
        loadedModel = runningData?.model ?? null;
      }
    } catch {
      // /api/running-models not available, try to infer from /api/models
    }

    if (!loadedModel && models.length > 0) {
      // Check if any model is loaded via /api/models
      try {
        const modelsRes = await fetch('http://localhost:1234/api/models', { signal: AbortSignal.timeout(1000) });
        if (modelsRes.ok) {
          const modelsData = await modelsRes.json();
          const loaded = modelsData?.data?.find((m: any) => m?.id?.includes?.('loaded') || m?.id?.includes?.('active'));
          if (loaded) loadedModel = loaded?.id ?? loaded?.name ?? null;
        }
      } catch {
        // Fallback: just report models available
      }
    }

    return {
      server: 'lmstudio',
      running: loadedModel !== null || models.length > 0,
      loadedModel,
      processor: loadedModel ? 'GPU' : null,
      vramUsed: loadedModel ? 'Loaded' : null,
      availableModels: models,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const [ollama, lmstudio] = await Promise.allSettled([
      probeOllama(),
      probeLmStudio(),
    ]);

    const result: ServerInfo = {
      server: null,
      running: false,
      loadedModel: null,
      processor: null,
      vramUsed: null,
      availableModels: [],
    };

    // Prefer Ollama if both are available
    if (ollama.status === 'fulfilled' && ollama.value) {
      Object.assign(result, ollama.value);
    }
    if (lmstudio.status === 'fulfilled' && lmstudio.value) {
      // Only use LM Studio if Ollama wasn't found
      if (!result.server) {
        Object.assign(result, lmstudio.value);
      } else {
        // If Ollama found, add LM Studio models too
        result.availableModels = [
          ...result.availableModels,
          ...lmstudio.value.availableModels.map((m: string) => `[LM Studio] ${m}`),
        ];
      }
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({
      server: null,
      running: false,
      loadedModel: null,
      processor: null,
      vramUsed: null,
      availableModels: [],
    });
  }
}
