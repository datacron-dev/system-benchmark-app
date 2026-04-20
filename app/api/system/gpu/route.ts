import { NextResponse } from 'next/server';
import si from 'systeminformation';
import { exec } from 'child_process';
import { promisify } from 'util';

export const dynamic = 'force-dynamic';

const execAsync = promisify(exec);

interface GpuData {
  utilization: number;
  vramUsed: number;
  vramTotal: number;
  powerDraw: number;
  temperature: number;
  clockSpeed: number;
  available: boolean;
  gpuName: string | null;
  timestamp: number;
}

interface SystemInfo {
  dgxOs: boolean;
  dgxOsVersion: string | null;
  gb10: boolean;
  unifiedMemory: boolean;
  unifiedMemoryTotalGB: number | null;
  nvlinkCount: number;
  nvSwitchCount: number;
  gpuName: string | null;
}

async function getNvidiaSmiData(): Promise<GpuData | null> {
  try {
    const { stdout } = await execAsync(
      'nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,power.draw,temperature.gpu,clocks.current.graphics,name --format=csv,noheader,nounits',
      { timeout: 3000 }
    );
    const parts = stdout.trim().split(',').map(s => s.trim());
    if (parts.length >= 7) {
      return {
        utilization: parseFloat(parts[0]) || 0,
        vramUsed: parseFloat(parts[1]) || 0,
        vramTotal: parseFloat(parts[2]) || 0,
        powerDraw: parseFloat(parts[3]) || 0,
        temperature: parseFloat(parts[4]) || 0,
        clockSpeed: parseFloat(parts[5]) || 0,
        available: true,
        gpuName: parts[6] || null,
        timestamp: Date.now(),
      };
    }
  } catch {
    // nvidia-smi not available
  }
  return null;
}

async function getSiGpuData(): Promise<GpuData | null> {
  try {
    const graphics = await si.graphics();
    const gpu = graphics.controllers?.[0];
    if (gpu) {
      // systeminformation returns memory in bytes; convert to MiB to match nvidia-smi format
      const memoryUsedMiB = Math.round((gpu.memoryUsed ?? 0) / (1024 * 1024));
      const memoryTotalMiB = Math.round(((gpu.memoryTotal ?? gpu.vram ?? 0)) / (1024 * 1024));
      return {
        utilization: gpu.utilizationGpu ?? 0,
        vramUsed: memoryUsedMiB,
        vramTotal: memoryTotalMiB,
        powerDraw: 0,
        temperature: gpu.temperatureGpu ?? 0,
        clockSpeed: gpu.clockCore ?? 0,
        available: true,
        gpuName: gpu.model || gpu.name || null,
        timestamp: Date.now(),
      };
    }
  } catch {
    // systeminformation GPU failed
  }
  return null;
}

async function detectSystemInfo(): Promise<SystemInfo> {
  const result: SystemInfo = {
    dgxOs: false,
    dgxOsVersion: null,
    gb10: false,
    unifiedMemory: false,
    unifiedMemoryTotalGB: null,
    nvlinkCount: 0,
    nvSwitchCount: 0,
    gpuName: null,
  };

  // Detect DGX OS
  try {
    const { stdout: dgxRelease } = await execAsync('cat /etc/nvidia-release-release 2>/dev/null || cat /etc/dgx-release 2>/dev/null || echo ""', { timeout: 2000 });
    const release = dgxRelease.trim().toLowerCase();
    if (release.includes('dgx') || release.includes('ubuntu') && release.includes('nvidia')) {
      result.dgxOs = true;
      result.dgxOsVersion = dgxRelease.trim() || 'DGX OS';
    }
  } catch {
    // DGX OS detection not available
  }

  // Detect GB10 Grace Blackwell
  try {
    const { stdout: gpuName } = await execAsync('nvidia-smi --query-gpu=name --format=csv,noheader,nounits', { timeout: 3000 });
    const name = (gpuName || '').trim();
    result.gpuName = name || null;

    if (name.includes('GB10') || name.toLowerCase().includes('grace blackwell')) {
      result.gb10 = true;
      result.unifiedMemory = true;
      // GB10 has either 144GB or 288GB unified memory
      // Check total system memory as proxy for unified memory size
      try {
        const { stdout: meminfo } = await execAsync('grep MemTotal /proc/meminfo', { timeout: 2000 });
        const match = meminfo.match(/(\d+)/);
        if (match) {
          const memGB = Math.round(parseInt(match[1]) / (1024 * 1024));
          result.unifiedMemoryTotalGB = memGB;
        }
      } catch {
        // Fall back to known GB10 configs
        result.unifiedMemoryTotalGB = name.includes('288') ? 288 : 144;
      }
    }
  } catch {
    // nvidia-smi not available for GB10 detection
  }

  // Detect NVLink links
  try {
    const { stdout: nvlink } = await execAsync('nvidia-smi nvlink --status=0 2>/dev/null | grep -c "Link is active" || echo "0"', { timeout: 3000 });
    result.nvlinkCount = parseInt(nvlink.trim()) || 0;
  } catch {
    // NVLink detection not available
  }

  // Detect NVSwitch count
  try {
    const { stdout: nvidiaTopo } = await execAsync('nvidia-smi topo -m 2>/dev/null | grep -c "NV1\\|NV2\\|NV3\\|NV4\\|NV5\\|NV6\\|NV7" || echo "0"', { timeout: 3000 });
    result.nvSwitchCount = parseInt(nvidiaTopo.trim()) || 0;
  } catch {
    // NVSwitch detection not available
  }

  return result;
}

export async function GET() {
  try {
    // Try nvidia-smi first (most reliable for NVIDIA GPUs)
    let data = await getNvidiaSmiData();
    if (!data) {
      data = await getSiGpuData();
    }

    const systemInfo = await detectSystemInfo();

    if (!data) {
      return NextResponse.json({
        utilization: 0,
        vramUsed: 0,
        vramTotal: 0,
        powerDraw: 0,
        temperature: 0,
        clockSpeed: 0,
        available: false,
        gpuName: null,
        timestamp: Date.now(),
        systemInfo,
      });
    }

    return NextResponse.json({
      ...data,
      systemInfo,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Failed to get GPU metrics', available: false, timestamp: Date.now() },
      { status: 500 }
    );
  }
}
