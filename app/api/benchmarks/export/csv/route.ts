export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const benchmarks = await prisma.benchmarkRun.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'Date', 'Model', 'PP', 'TG', 'Concurrency', 'Runs',
      'Status', 't/s Total', 't/s Per Req', 'Peak t/s',
      'TTFR (ms)', 'est_ppt (ms)', 'Duration (s)', 'Notes'
    ];

    const rows = (benchmarks ?? []).map((b: any) => [
      b?.createdAt?.toISOString?.() ?? '',
      b?.model ?? '',
      b?.pp ?? '',
      b?.tg ?? '',
      b?.concurrency ?? '',
      b?.runs ?? '',
      b?.status ?? '',
      b?.tsTotal ?? '',
      b?.tsReq ?? '',
      b?.peakTs ?? '',
      b?.ttfr ?? '',
      b?.estPpt ?? '',
      b?.duration ?? '',
      (b?.notes ?? '').replace(/,/g, ';'),
    ]);

    const csv = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="system-benchmarks-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting CSV:', error);
    return NextResponse.json({ error: 'Failed to export CSV' }, { status: 500 });
  }
}
