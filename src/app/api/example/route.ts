/**
 * Example: Using New Middleware & Error Handler
 * 
 * This is an example of how to use the new auth middleware and error handler
 * in your API routes.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import { rateLimit, rateLimitPresets } from '@/middleware/rateLimit';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import type { TokenPayload } from '@/types';

function ensureExampleRouteEnabled() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  return null;
}

/**
 * Example 1: Basic GET endpoint with authentication
 */
export const GET = withAuth(
  async (request: NextRequest, user: TokenPayload) => {
    const disabledResponse = ensureExampleRouteEnabled();
    if (disabledResponse) return disabledResponse;

    logger.apiRequest('GET', '/api/example', { userId: user.userId });

    // Your logic here
    const data = {
      message: 'Hello from protected endpoint',
      user: {
        id: user.userId,
        email: user.email,
        role: user.role,
      },
    };

    return NextResponse.json({
      success: true,
      data,
    });
  },
  {
    roles: ['ADMIN', 'TEACHER'], // Optional: restrict to specific roles
  }
);

/**
 * Example 2: POST endpoint with rate limiting + error handling
 */
export const POST = asyncHandler(async (request: NextRequest) => {
  const disabledResponse = ensureExampleRouteEnabled();
  if (disabledResponse) return disabledResponse;

  const startTime = Date.now();

  // Apply rate limiting
  const rateLimitResponse = await rateLimit(rateLimitPresets.moderate)(request);
  if (rateLimitResponse) return rateLimitResponse;

  // Authenticate request
  const { authenticateRequest } = await import('@/middleware/auth');
  const user = await authenticateRequest(request);

  // Parse and validate body
  const body = await request.json();
  
  if (!body.name) {
    throw new ValidationError('Name is required');
  }

  // Database operation
  const item = await prisma.student.findUnique({
    where: { id: body.id },
  });

  if (!item) {
    throw new NotFoundError('Student not found');
  }

  // Log API response
  const duration = Date.now() - startTime;
  logger.apiResponse('POST', '/api/example', 200, duration);

  return NextResponse.json({
    success: true,
    data: item,
  });
});

/**
 * Example 3: Manual error handling (without asyncHandler)
 */
export async function PUT(request: NextRequest) {
  const disabledResponse = ensureExampleRouteEnabled();
  if (disabledResponse) return disabledResponse;

  try {
    const { handleError } = await import('@/middleware/errorHandler');
    
    // Your logic here
    const body = await request.json();
    
    // Simulate error
    if (!body.id) {
      throw new ValidationError('ID is required');
    }

    return NextResponse.json({
      success: true,
      message: 'Updated successfully',
    });
  } catch (error) {
    const { handleError } = await import('@/middleware/errorHandler');
    return handleError(error);
  }
}

/**
 * Example 4: Rate limiting on sensitive endpoint
 */
export async function DELETE(request: NextRequest) {
  const disabledResponse = ensureExampleRouteEnabled();
  if (disabledResponse) return disabledResponse;

  // Very strict rate limiting for delete operations
  const rateLimitResponse = await rateLimit(rateLimitPresets.veryStrict)(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { authenticateRequest, checkRole } = await import('@/middleware/auth');
    const user = await authenticateRequest(request);
    
    // Only ADMIN can delete
    checkRole(user, ['ADMIN']);

    // Delete logic here
    logger.warn('Delete operation', { userId: user.userId });

    return NextResponse.json({
      success: true,
      message: 'Deleted successfully',
    });
  } catch (error) {
    const { handleError } = await import('@/middleware/errorHandler');
    return handleError(error);
  }
}
