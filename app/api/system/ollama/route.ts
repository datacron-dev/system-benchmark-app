import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

export const dynamic = 'force-dynamic';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const execAsync = promisify(exec);

async function getGpuName(): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      'nvidia-smi --query-gpu=name --format=csv,noheader,nounits',
      { timeout: 3000 }
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const [tagsRes, psRes] = await Promise.allSettled([
      fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: controller.signal }),
      fetch(`${OLLAMA_BASE_URL}/api/ps`, { signal: controller.signal }),
    ]);

    clearTimeout(timeout);

    const availableModels: string[] = [];
    let loadedModel: string | null = null;
    let processor: string | null = null;
    let vramUsed: string | null = null;

    // Parse available models
    if (tagsRes.status === 'fulfilled' && tagsRes.value.ok) {
      const tagsData = await tagsRes.value.json();
      if (tagsData?.models) {
        for (const m of tagsData.models) {
          if (m?.name) availableModels.push(m.name);
        }
      }
    }

    // Parse running models
    if (psRes.status === 'fulfilled' && psRes.value.ok) {
      const psData = await psRes.value.json();
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

    // Get GPU name for display
    const gpuName = await getGpuName();

    // If we have a GPU name and processor is GPU, enhance the processor string
    if (gpuName && processor) {
      if (processor === 'GPU') {
        processor = gpuName;
      } else if (processor.startsWith('GPU/CPU')) {
        processor = `${gpuName} (${processor})`;
      }
    } else if (gpuName && !processor) {
      processor = gpuName;
    }

    const running = availableModels.length > 0 || loadedModel !== null;

    return NextResponse.json({
      running,
      loadedModel,
      processor,
      vramUsed,
      availableModels,
    });
  } catch (e: any) {
    return NextResponse.json({
      running: false,
      loadedModel: null,
      processor: null,
      vramUsed: null,
      availableModels: [],
    });
  }
}
