import { Prisma, UserRole, ActivityAction, ActivityStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/auth/middleware';
import { getAuthenticatedUser } from '@/lib/auth/access';
import { serverError } from '@/lib/server-log';

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
    const where: Prisma.ActivityLogWhereInput = {};

    // User filter
    const userId = searchParams.get('userId');
    if (userId) {
      where.userId = userId;
    }

    // Action filter
    const action = searchParams.get('action');
    if (action && Object.values(ActivityAction).includes(action as ActivityAction)) {
      where.action = action as ActivityAction;
    }

    // Resource type filter
    const resourceType = searchParams.get('resourceType');
    if (resourceType) {
      where.resourceType = {
        contains: resourceType,
        mode: 'insensitive',
      };
    }

    // Resource ID filter
    const resourceId = searchParams.get('resourceId');
    if (resourceId) {
      where.resourceId = resourceId;
    }

    // Status filter
    const status = searchParams.get('status');
    if (status && Object.values(ActivityStatus).includes(status as ActivityStatus)) {
      where.status = status as ActivityStatus;
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
    serverError('Error fetching activity logs:', error);
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
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== UserRole.ADMIN) {
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
        byAction: Object.fromEntries(byAction.map((a) => [a.action, a._count])),
        byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
        today,
        thisWeek,
      },
    });
  } catch (error) {
    serverError('Error fetching activity summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity summary' },
      { status: 500 }
    );
  }
}
