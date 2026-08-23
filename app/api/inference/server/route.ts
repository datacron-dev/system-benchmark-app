import { NextRequest, NextResponse } from 'next/server';

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
    // LM Studio uses OpenAI-compatible /v1/ endpoints
    const modelsRes = await fetch('http://localhost:1234/v1/models', { signal: AbortSignal.timeout(2000) });
    if (!modelsRes.ok) return null;
    const modelsData = await modelsRes.json();
    const models = (modelsData?.data ?? []).map((m: any) => m?.id).filter(Boolean);

    // Detect loaded model by sending a lightweight request with empty model string.
    // LM Studio responds with the currently loaded model name in the response.
    let loadedModel: string | null = null;
    try {
      const probeRes = await fetch('http://localhost:1234/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: '',
          messages: [{ role: 'user', content: '.' }],
          max_tokens: 1,
          stream: false,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (probeRes.ok) {
        const probeData = await probeRes.json();
        loadedModel = probeData?.model ?? null;
      }
    } catch {
      // Could not detect loaded model — LM Studio may not have one loaded
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const filterServer = searchParams.get('server'); // 'ollama' | 'lmstudio' | null

    let ollamaResult: ServerInfo | null = null;
    let lmstudioResult: ServerInfo | null = null;

    if (!filterServer || filterServer === 'ollama') {
      ollamaResult = await probeOllama();
    }
    if (!filterServer || filterServer === 'lmstudio') {
      lmstudioResult = await probeLmStudio();
    }

    // Single-server mode (legacy + filtered)
    if (filterServer) {
      const result = filterServer === 'ollama' ? ollamaResult : lmstudioResult;
      if (result) {
        return NextResponse.json(result);
      }
      return NextResponse.json({
        server: null,
        running: false,
        loadedModel: null,
        processor: null,
        vramUsed: null,
        availableModels: [],
      });
    }

    // Combined mode: return both servers
    const servers = [];
    const allModels: string[] = [];

    if (ollamaResult) {
      servers.push({
        server: ollamaResult.server,
        running: ollamaResult.running,
        loadedModel: ollamaResult.loadedModel,
        processor: ollamaResult.processor,
        vramUsed: ollamaResult.vramUsed,
      });
      allModels.push(...ollamaResult.availableModels.map((m) => `[Ollama] ${m}`));
    }

    if (lmstudioResult) {
      servers.push({
        server: lmstudioResult.server,
        running: lmstudioResult.running,
        loadedModel: lmstudioResult.loadedModel,
        processor: lmstudioResult.processor,
        vramUsed: lmstudioResult.vramUsed,
      });
      allModels.push(...lmstudioResult.availableModels.map((m) => `[LM Studio] ${m}`));
    }

    return NextResponse.json({ servers, availableModels: allModels });
  } catch (e: any) {
    return NextResponse.json({ servers: [], availableModels: [] });
  }
}
