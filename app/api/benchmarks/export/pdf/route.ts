export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const benchmarks = await prisma.benchmarkRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const completedRuns = (benchmarks ?? []).filter((b: any) => b?.status === 'completed');
    const avgTsTotal = completedRuns.length > 0 
      ? (completedRuns.reduce((sum: number, b: any) => sum + (b?.tsTotal ?? 0), 0) / completedRuns.length).toFixed(1) 
      : 'N/A';
    const avgTtfr = completedRuns.length > 0 
      ? (completedRuns.reduce((sum: number, b: any) => sum + (b?.ttfr ?? 0), 0) / completedRuns.length).toFixed(1) 
      : 'N/A';
    const bestTs = completedRuns.length > 0
      ? Math.max(...completedRuns.map((b: any) => b?.peakTs ?? 0)).toFixed(1)
      : 'N/A';

    const tableRows = (benchmarks ?? []).map((b: any) => `
      <tr>
        <td>${b?.createdAt?.toISOString?.()?.split('T')?.[0] ?? 'N/A'}</td>
        <td>${b?.model ?? 'N/A'}</td>
        <td>${b?.pp ?? '-'}</td>
        <td>${b?.tg ?? '-'}</td>
        <td>${b?.concurrency ?? '-'}</td>
        <td>${b?.tsTotal?.toFixed?.(1) ?? '-'}</td>
        <td>${b?.tsReq?.toFixed?.(1) ?? '-'}</td>
        <td>${b?.peakTs?.toFixed?.(1) ?? '-'}</td>
        <td>${b?.ttfr?.toFixed?.(1) ?? '-'}</td>
        <td>${b?.estPpt?.toFixed?.(1) ?? '-'}</td>
        <td>${b?.status ?? '-'}</td>
      </tr>
    `).join('');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>System Benchmark Report</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; }
      .no-print { display: none !important; }
    }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; padding: 40px; max-width: 1200px; margin: 0 auto; background: white; }
    h1 { color: #0D0E1A; font-size: 28px; border-bottom: 3px solid #00b89a; padding-bottom: 10px; }
    h2 { color: #2A2D45; font-size: 18px; margin-top: 30px; }
    .meta { color: #666; font-size: 13px; margin-bottom: 30px; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
    .summary-card { background: #f0f4f8; border-radius: 8px; padding: 16px; text-align: center; }
    .summary-card .value { font-size: 28px; font-weight: bold; color: #00b89a; }
    .summary-card .label { font-size: 12px; color: #666; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #0D0E1A; color: #00FFD1; padding: 10px 6px; text-align: left; font-weight: 600; }
    td { padding: 8px 6px; border-bottom: 1px solid #e0e0e0; }
    tr:nth-child(even) { background: #f8f9fa; }
    .footer { margin-top: 40px; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
    .print-btn { 
      position: fixed; top: 20px; right: 20px; z-index: 100;
      background: #00b89a; color: white; border: none; padding: 12px 24px; 
      border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: 600;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .print-btn:hover { background: #009e84; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">⬇ Print / Save as PDF</button>
  <h1>⚡ System Benchmark Report</h1>
  <div class="meta">
    Generated: ${new Date().toISOString().replace('T', ' ').split('.')[0]} UTC<br>
    Total Runs: ${benchmarks?.length ?? 0} | Completed: ${completedRuns?.length ?? 0}
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="value">${avgTsTotal}</div>
      <div class="label">Avg t/s (Total)</div>
    </div>
    <div class="summary-card">
      <div class="value">${avgTtfr}</div>
      <div class="label">Avg TTFR (ms)</div>
    </div>
    <div class="summary-card">
      <div class="value">${bestTs}</div>
      <div class="label">Best Peak t/s</div>
    </div>
  </div>

  <h2>Benchmark History</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Model</th><th>PP</th><th>TG</th><th>Conc.</th>
        <th>t/s Total</th><th>t/s Req</th><th>Peak t/s</th>
        <th>TTFR (ms)</th><th>PPT (ms)</th><th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || '<tr><td colspan="11" style="text-align:center;padding:20px;">No benchmark data available</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    System Benchmark Dashboard &mdash; LLM Inference Stress Testing Tool
  </div>

  <script class="no-print">
    // Auto-trigger print dialog for direct PDF save
    if (window.location.search.includes('autoprint=1')) {
      window.onload = function() { setTimeout(function() { window.print(); }, 500); };
    }
  </script>
</body>
</html>`;

    // Return the HTML report directly - users can use browser print to PDF
    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error: any) {
    console.error('Error generating PDF report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
