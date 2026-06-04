/**
 * Health Check Endpoint
 * Untuk monitoring dan load balancer health checks
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Check database connection
 */
async function checkDatabase(): Promise<{
  status: 'up' | 'down';
  responseTime?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    // Simple query untuk test connection
    await prisma.$queryRaw`SELECT 1`;

    const responseTime = Date.now() - startTime;

    return {
      status: 'up',
      responseTime,
    };
  } catch (error) {
    return {
      status: 'down',
      error: isProduction ? undefined : error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Get memory usage
 */
function getMemoryUsage() {
  const usage = process.memoryUsage();
  const total = usage.heapTotal;
  const used = usage.heapUsed;

  return {
    used: Math.round(used / 1024 / 1024), // MB
    total: Math.round(total / 1024 / 1024), // MB
    percentage: Math.round((used / total) * 100),
  };
}

/**
 * GET /api/health - Basic health check
 */
export async function GET(): Promise<NextResponse> {
  const timestamp = new Date().toISOString();

  const databaseCheck = await checkDatabase();
  const isHealthy = databaseCheck.status === 'up';
  const statusCode = isHealthy ? 200 : 503;

  if (isProduction) {
    return NextResponse.json(
      {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp,
      },
      { status: statusCode }
    );
  }

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp,
      uptime: Math.round(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: databaseCheck,
        memory: getMemoryUsage(),
      },
    },
    { status: statusCode }
  );
}

/**
 * HEAD /api/health - Lightweight health check (no body)
 * Useful untuk load balancers yang hanya check status code
 */
export async function HEAD(): Promise<NextResponse> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
