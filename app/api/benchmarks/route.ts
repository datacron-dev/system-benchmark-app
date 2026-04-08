export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const limit = parseInt(url.searchParams.get('limit') ?? '50');
    const model = url.searchParams.get('model') ?? undefined;
    const status = url.searchParams.get('status') ?? undefined;

    const where: any = {};
    if (model) where.model = model;
    if (status) where.status = status;

    const [benchmarks, total] = await Promise.all([
      prisma.benchmarkRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.benchmarkRun.count({ where }),
    ]);

    return NextResponse.json({
      benchmarks: benchmarks?.map((b: any) => ({
        ...b,
        createdAt: b?.createdAt?.toISOString?.() ?? '',
      })) ?? [],
      total: total ?? 0,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('Error fetching benchmarks:', error);
    return NextResponse.json({ benchmarks: [], total: 0, page: 1, limit: 50 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const benchmark = await prisma.benchmarkRun.create({
      data: {
        model: body?.model ?? 'unknown',
        pp: body?.pp ?? 512,
        tg: body?.tg ?? 128,
        concurrency: body?.concurrency ?? 1,
        runs: body?.runs ?? 3,
        status: body?.status ?? 'pending',
        tsTotal: body?.tsTotal ?? null,
        tsReq: body?.tsReq ?? null,
        peakTs: body?.peakTs ?? null,
        ttfr: body?.ttfr ?? null,
        estPpt: body?.estPpt ?? null,
        duration: body?.duration ?? null,
        logOutput: body?.logOutput ?? null,
        notes: body?.notes ?? null,
      },
    });

    return NextResponse.json({
      ...benchmark,
      createdAt: benchmark?.createdAt?.toISOString?.() ?? '',
    });
  } catch (error: any) {
    console.error('Error creating benchmark:', error);
    return NextResponse.json({ error: 'Failed to create benchmark' }, { status: 500 });
  }
}
