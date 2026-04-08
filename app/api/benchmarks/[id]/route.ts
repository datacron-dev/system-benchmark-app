export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const benchmark = await prisma.benchmarkRun.findUnique({
      where: { id: params?.id ?? '' },
    });
    if (!benchmark) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({
      ...benchmark,
      createdAt: benchmark?.createdAt?.toISOString?.() ?? '',
    });
  } catch (error: any) {
    console.error('Error fetching benchmark:', error);
    return NextResponse.json({ error: 'Failed to fetch benchmark' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const benchmark = await prisma.benchmarkRun.update({
      where: { id: params?.id ?? '' },
      data: body ?? {},
    });
    return NextResponse.json({
      ...benchmark,
      createdAt: benchmark?.createdAt?.toISOString?.() ?? '',
    });
  } catch (error: any) {
    console.error('Error updating benchmark:', error);
    return NextResponse.json({ error: 'Failed to update benchmark' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.benchmarkRun.delete({
      where: { id: params?.id ?? '' },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting benchmark:', error);
    return NextResponse.json({ error: 'Failed to delete benchmark' }, { status: 500 });
  }
}
