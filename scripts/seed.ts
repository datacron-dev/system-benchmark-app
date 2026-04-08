import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MODELS = [
  'llama3.1:8b-instruct-q4_K_M',
  'mistral:7b-instruct-v0.3-q4_K_M',
  'codellama:13b-instruct-q4_K_M',
  'phi-3:mini-4k-instruct-q4_K_M',
  'gemma2:9b-instruct-q4_K_M',
  'qwen2.5:7b-instruct-q4_K_M',
];

const CONFIGS = [
  { pp: 512, tg: 128, concurrency: 1, runs: 3, label: 'Single User' },
  { pp: 512, tg: 128, concurrency: 4, runs: 3, label: 'Light Load' },
  { pp: 1024, tg: 256, concurrency: 8, runs: 5, label: 'Mixed Load' },
  { pp: 2048, tg: 512, concurrency: 32, runs: 5, label: 'Stress Test' },
];

async function main() {
  console.log('Seeding System benchmark history...');

  for (let i = 0; i < 12; i++) {
    const model = MODELS[i % MODELS.length] ?? 'llama3.1:8b';
    const config = CONFIGS[i % CONFIGS.length] ?? CONFIGS[0];
    const date = new Date();
    date.setDate(date.getDate() - (12 - i));
    date.setHours(10 + Math.floor(Math.random() * 8));

    const baseTsReq = 30 + Math.random() * 20;
    const tsTotal = baseTsReq * (config?.concurrency ?? 1) * (0.7 + Math.random() * 0.3);
    const ttfr = 180 + Math.random() * 200;

    const id = `seed-${i.toString().padStart(3, '0')}`;

    await prisma.benchmarkRun.upsert({
      where: { id },
      update: {},
      create: {
        id,
        createdAt: date,
        model,
        pp: config?.pp ?? 512,
        tg: config?.tg ?? 128,
        concurrency: config?.concurrency ?? 1,
        runs: config?.runs ?? 3,
        status: 'completed',
        tsTotal: Math.round(tsTotal * 10) / 10,
        tsReq: Math.round(baseTsReq * 10) / 10,
        peakTs: Math.round((baseTsReq + Math.random() * 8) * 10) / 10,
        ttfr: Math.round(ttfr * 10) / 10,
        estPpt: Math.round((15 + Math.random() * 10) * 10) / 10,
        duration: Math.round((10 + Math.random() * 30) * 10) / 10,
        notes: `${config?.label ?? 'Test'} benchmark`,
      },
    });
  }

  console.log('Seeded 12 demo benchmark runs.');
}

main()
  .catch((e: any) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
