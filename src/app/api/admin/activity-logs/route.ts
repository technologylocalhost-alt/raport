import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/auth/middleware';
import { UserRole, ActivityAction, ActivityStatus } from '@prisma/client';

/**
 * GET /api/admin/activity-logs
 * Fetch activity logs (admin only)
 * 
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 50)
 * - userId: string (filter by user)
 * - action: ActivityAction (filter by action type)
 * - resourceType: string (filter by resource type)
 * - resourceId: string (filter by resource id)
 * - status: ActivityStatus (filter by status)
 * - startDate: ISO string (filter by date range start)
 * - endDate: ISO string (filter by date range end)
 */

export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    // Only admins can view activity logs
    if (user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'Unauthorized: Only admins can view activity logs' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    // Build filter object
    const where: any = {};

    // User filter
    if (searchParams.has('userId')) {
      where.userId = searchParams.get('userId');
    }

    // Action filter
    if (searchParams.has('action')) {
      const action = searchParams.get('action');
      if (Object.values(ActivityAction).includes(action as any)) {
        where.action = action;
      }
    }

    // Resource type filter
    if (searchParams.has('resourceType')) {
      where.resourceType = {
        contains: searchParams.get('resourceType'),
        mode: 'insensitive',
      };
    }

    // Resource ID filter
    if (searchParams.has('resourceId')) {
      where.resourceId = searchParams.get('resourceId');
    }

    // Status filter
    if (searchParams.has('status')) {
      const status = searchParams.get('status');
      if (Object.values(ActivityStatus).includes(status as any)) {
        where.status = status;
      }
    }

    // Date range filter
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Fetch logs with pagination
    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity logs' },
      { status: 500 }
    );
  }
});

/**
 * GET /api/admin/activity-logs/summary
 * Get activity summary/statistics
 */
export async function getSummary(request: NextRequest) {
  try {
    // Verify auth
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get stats
    const [totalLogs, byAction, byStatus, today, thisWeek] = await Promise.all([
      prisma.activityLog.count(),
      prisma.activityLog.groupBy({
        by: ['action'],
        _count: true,
      }),
      prisma.activityLog.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.activityLog.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.activityLog.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalLogs,
        byAction: Object.fromEntries(byAction.map(a => [a.action, a._count])),
        byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
        today,
        thisWeek,
      },
    });
  } catch (error) {
    console.error('Error fetching activity summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity summary' },
      { status: 500 }
    );
  }
}
