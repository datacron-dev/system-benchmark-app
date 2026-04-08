import { PrismaClient } from '@prisma/client';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

// Ensure the data directory exists for SQLite
const dataDir = join(process.cwd(), 'prisma', 'data');
if (!existsSync(dataDir)) {
  try { mkdirSync(dataDir, { recursive: true }); } catch {}
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
