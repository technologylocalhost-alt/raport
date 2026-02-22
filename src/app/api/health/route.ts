/**
 * Health Check Endpoint
 * Untuk monitoring dan load balancer health checks
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: {
      status: 'up' | 'down';
      responseTime?: number;
      error?: string;
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

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
      error: error instanceof Error ? error.message : 'Unknown database error',
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
export async function GET(request: NextRequest): Promise<NextResponse<HealthCheckResponse>> {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();
  const version = process.env.npm_package_version || '1.0.0';

  // Check database
  const databaseCheck = await checkDatabase();

  // Check memory
  const memoryCheck = getMemoryUsage();

  // Determine overall health status
  const isHealthy = databaseCheck.status === 'up';

  const response: HealthCheckResponse = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp,
    uptime: Math.round(uptime),
    version,
    checks: {
      database: databaseCheck,
      memory: memoryCheck,
    },
  };

  const statusCode = isHealthy ? 200 : 503;

  return NextResponse.json(response, { status: statusCode });
}

/**
 * HEAD /api/health - Lightweight health check (no body)
 * Useful untuk load balancers yang hanya check status code
 */
export async function HEAD(): Promise<NextResponse> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}
