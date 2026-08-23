import { NextResponse } from 'next/server';
import si from 'systeminformation';
import os from 'os';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [cpuLoad, mem] = await Promise.all([
      si.currentLoad(),
      si.mem(),
    ]);

    const ramTotalGB = Math.round((mem.total / (1024 ** 3)) * 10) / 10;
    const ramUsedGB = Math.round(((mem.total - mem.available) / (1024 ** 3)) * 10) / 10;
    const ramPercent = Math.round((ramUsedGB / ramTotalGB) * 1000) / 10;

    // Get basic system info
    const cpuInfo = os.cpus();
    let cpuModel = cpuInfo?.[0]?.model ?? 'Unknown CPU';

    // On ARM64, Node.js os.cpus() returns "unknown" because /proc/cpuinfo
    // lacks an x86-style "Model name" field. Parse it ourselves.
    if (cpuModel === 'unknown' || cpuModel === '') {
      try {
        const fs = await import('fs');
        const cpuinfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
        const partMatch = cpuinfo.match(/CPU part\s*:\s*(0x[0-9a-fA-F]+)/);
        const implementerMatch = cpuinfo.match(/CPU implementer\s*:\s*(0x[0-9a-fA-F]+)/);
        if (partMatch && implementerMatch) {
          const part = parseInt(partMatch[1], 16);
          const implementer = parseInt(implementerMatch[1], 16);
          // ARM implementer = 0x41
          const ARM_PARTS: Record<number, string> = {
            0xd0f: 'ARM Neoverse V4',
            0xd40: 'ARM Neoverse N2',
            0xd47: 'ARM Neoverse V2',
            0xd44: 'ARM Neoverse V3',
            0xd4c: 'ARM Neoverse N1',
            0xd08: 'ARM Neoverse N1',
            0xd07: 'ARM Cortex-A76',
            0xd0b: 'ARM Cortex-A77',
            0xd4d: 'ARM Cortex-A78',
            0xd4e: 'ARM Cortex-A78AE',
            0xd4f: 'ARM Cortex-A710',
            0xd82: 'ARM Cortex-A715',
            0xd83: 'ARM Cortex-A720',
            0xd84: 'ARM Cortex-X3',
            0xd87: 'ARM Cortex-X4',
            0xd88: 'ARM Cortex-X925',
            0xd8b: 'ARM Cortex-X4 (extended)',
          };
          if (implementer === 0x41 && ARM_PARTS[part]) {
            cpuModel = ARM_PARTS[part];
          } else if (implementer === 0x50 && part === 0x010) {
            // Ampere Computing
            cpuModel = 'Ampere Altra';
          } else if (implementer === 0x48) {
            // Broadcom/BCM
            cpuModel = 'Broadcom CPU';
          } else {
            cpuModel = `ARM ARMv${cpuinfo.match(/CPU architecture\s*:\s*(\d+)/)?.[1] ?? '8'} (part 0x${part?.toString(16) ?? 'unknown'})`;
          }
        }
      } catch {
        // Fallback to "Unknown CPU"
      }
    }

    const cpuCores = cpuInfo?.length ?? 0;
    const platform = os.platform();
    const arch = os.arch();
    const hostname = os.hostname();
    const uptime = os.uptime();

    return NextResponse.json({
      cpuPercent: Math.round((cpuLoad.currentLoad ?? 0) * 10) / 10,
      ramUsed: ramUsedGB,
      ramTotal: ramTotalGB,
      ramPercent,
      cpuModel,
      cpuCores,
      platform,
      arch,
      hostname,
      uptime,
      timestamp: Date.now(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Failed to get system metrics' },
      { status: 500 }
    );
  }
}
