import { prisma } from './db';
import { ActivityAction, ActivityStatus } from '@prisma/client';
import { NextRequest } from 'next/server';
import { serverError } from '@/lib/server-log';

/**
 * Activity Logging Utility
 * Handles all activity logging for the application
 */

type SerializableValue = unknown;

interface SocketRequestLike {
  socket?: {
    remoteAddress?: string;
  };
}

export interface LogActivityParams {
  userId: string;
  action: ActivityAction;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  description?: string;
  oldValue?: SerializableValue;
  newValue?: SerializableValue;
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

    return activity;
  } catch (error) {
    serverError('Error logging activity:', error);
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
    const socket = (request as NextRequest & SocketRequestLike).socket;
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
  error: unknown
) {
  return logActivity({
    ...params,
    status: 'FAILED',
    errorMessage: error instanceof Error ? error.message : 'Unknown error',
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
export function getChangedFields(
  oldData: Record<string, unknown> | null | undefined,
  newData: Record<string, unknown>
): {
  changed: boolean;
  changes: Record<string, { old: unknown; new: unknown }>;
} {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

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
