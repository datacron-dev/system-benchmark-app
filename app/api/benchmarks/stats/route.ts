export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const total = await prisma.benchmarkRun.count();
    const completed = await prisma.benchmarkRun.count({ where: { status: 'completed' } });
    
    const completedRuns = await prisma.benchmarkRun.findMany({
      where: { status: 'completed' },
      select: { tsTotal: true, ttfr: true, peakTs: true },
    });

    const avgTsTotal = completedRuns?.length > 0
      ? completedRuns.reduce((s: number, r: any) => s + (r?.tsTotal ?? 0), 0) / completedRuns.length
      : 0;
    const avgTtfr = completedRuns?.length > 0
      ? completedRuns.reduce((s: number, r: any) => s + (r?.ttfr ?? 0), 0) / completedRuns.length
      : 0;
    const bestPeakTs = completedRuns?.length > 0
      ? Math.max(...completedRuns.map((r: any) => r?.peakTs ?? 0))
      : 0;

    const models = await prisma.benchmarkRun.groupBy({
      by: ['model'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    return NextResponse.json({
      total: total ?? 0,
      completed: completed ?? 0,
      avgTsTotal: Math.round(avgTsTotal * 10) / 10,
      avgTtfr: Math.round(avgTtfr * 10) / 10,
      bestPeakTs: Math.round(bestPeakTs * 10) / 10,
      models: (models ?? []).map((m: any) => ({ model: m?.model ?? '', count: m?._count?.id ?? 0 })),
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ total: 0, completed: 0, avgTsTotal: 0, avgTtfr: 0, bestPeakTs: 0, models: [] });
  }
}
