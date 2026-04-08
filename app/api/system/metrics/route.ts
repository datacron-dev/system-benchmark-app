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
    const cpuModel = cpuInfo?.[0]?.model ?? 'Unknown CPU';
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
