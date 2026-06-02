import { prisma } from './db';
import { ActivityAction, ActivityStatus } from '@prisma/client';
import { NextRequest } from 'next/server';

/**
 * Activity Logging Utility
 * Handles all activity logging for the application
 */

export interface LogActivityParams {
  userId: string;
  action: ActivityAction;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  description?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  status?: ActivityStatus;
  errorMessage?: string;
}

/**
 * Log an activity to the database
 */
export async function logActivity(params: LogActivityParams) {
  try {
    // Only log if userId is provided
    if (!params.userId) {
      console.warn('Activity logging skipped: userId not provided');
      return null;
    }

    const {
      oldValue,
      newValue,
      ...logData
    } = params;

    // Convert objects to JSON strings for storage
    const oldValueStr = oldValue ? JSON.stringify(oldValue) : null;
    const newValueStr = newValue ? JSON.stringify(newValue) : null;

    const activity = await prisma.activityLog.create({
      data: {
        ...logData,
        oldValue: oldValueStr,
        newValue: newValueStr,
        status: logData.status || 'SUCCESS',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    console.log(
      `[ActivityLog] ${params.action} | ${params.resourceType} | User: ${params.userId}`
    );

    return activity;
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw - activity logging should never break the main flow
    return null;
  }
}

/**
 * Extract client IP address from request
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // For Request objects (which NextRequest extends), try socket.remoteAddress
  // In most cases, this will fail in serverless environments, so we fallback to 'unknown'
  try {
    const socket = (request as any).socket;
    if (socket?.remoteAddress) {
      return socket.remoteAddress;
    }
  } catch {
    // Socket access may not work in all environments
  }
  
  return 'unknown';
}

/**
 * Extract user agent from request
 */
export function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown';
}

/**
 * Helper to log failed request with error
 */
export async function logActivityError(
  params: LogActivityParams,
  error: any
) {
  return logActivity({
    ...params,
    status: 'FAILED',
    errorMessage: error?.message || 'Unknown error',
  });
}

/**
 * Helper to log bulk operations
 */
export async function logBulkActivity(
  userId: string,
  action: ActivityAction,
  resourceType: string,
  description: string,
  totalRecords: number,
  successCount: number,
  ipAddress?: string,
  userAgent?: string
) {
  const status = successCount === totalRecords ? 'SUCCESS' : successCount > 0 ? 'PARTIAL' : 'FAILED';

  return logActivity({
    userId,
    action,
    resourceType,
    resourceId: `bulk_${Date.now()}`,
    description: `${description} - ${successCount}/${totalRecords} successful`,
    status: status as ActivityStatus,
    ipAddress,
    userAgent,
  });
}

/**
 * Helper to compare old and new values for update logs
 */
export function getChangedFields(oldData: any, newData: any): {
  changed: boolean;
  changes: Record<string, { old: any; new: any }>;
} {
  const changes: Record<string, { old: any; new: any }> = {};

  for (const key in newData) {
    const oldVal = oldData?.[key];
    const newVal = newData[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = { old: oldVal, new: newVal };
    }
  }

  return {
    changed: Object.keys(changes).length > 0,
    changes,
  };
}
