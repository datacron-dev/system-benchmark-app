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
      return {
        utilization: gpu.utilizationGpu ?? 0,
        vramUsed: gpu.memoryUsed ?? 0,
        vramTotal: gpu.memoryTotal ?? gpu.vram ?? 0,
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

export async function GET() {
  try {
    // Try nvidia-smi first (most reliable for NVIDIA GPUs)
    let data = await getNvidiaSmiData();
    if (!data) {
      data = await getSiGpuData();
    }
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
      });
    }
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Failed to get GPU metrics', available: false, timestamp: Date.now() },
      { status: 500 }
    );
  }
}
