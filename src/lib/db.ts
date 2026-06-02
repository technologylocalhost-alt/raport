import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString && process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is required in production');
  }

  // Use PrismaPg adapter for better performance
  if (connectionString) {
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool as any);
    return new PrismaClient({ adapter });
  }

  // Fallback for development/testing without explicit adapter
  return new PrismaClient();
}

export const prisma =
  globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
