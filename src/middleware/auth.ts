/**
 * Authentication Middleware
 * Centralized auth logic untuk reusability
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { UnauthorizedError, ForbiddenError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { UserRole } from '@/types';
import type { TokenPayload } from '@/types';

export interface AuthenticatedRequest extends NextRequest {
  user?: TokenPayload;
}

/**
 * Extract token from Authorization header
 */
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return null;
  }

  // Support both formats: "Bearer TOKEN" and "TOKEN"
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }

  return null;
}

/**
 * Verify and decode JWT token
 */
export async function authenticateRequest(request: NextRequest): Promise<TokenPayload> {
  const token = extractToken(request);

  if (!token) {
    logger.warn('Authentication failed: No token provided', {
      path: request.nextUrl.pathname,
    });
    throw new UnauthorizedError('Token tidak ditemukan. Silakan login terlebih dahulu.');
  }

  try {
    const decoded = verifyToken(token);
    
    logger.debug('Token verified successfully', {
      userId: decoded.userId,
      role: decoded.role,
    });

    return decoded;
  } catch (error) {
    logger.warn('Authentication failed: Invalid token', {
      path: request.nextUrl.pathname,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new UnauthorizedError('Token tidak valid atau telah kadaluarsa. Silakan login kembali.');
  }
}

/**
 * Check if user has required role
 */
export function checkRole(user: TokenPayload, allowedRoles: UserRole[]): void {
  if (!allowedRoles.includes(user.role as UserRole)) {
    logger.warn('Authorization failed: Insufficient permissions', {
      userId: user.userId,
      userRole: user.role,
      requiredRoles: allowedRoles,
    });
    throw new ForbiddenError('Anda tidak memiliki akses untuk resource ini.');
  }
}

/**
 * HOF untuk wrap API handler dengan authentication
 */
export function withAuth(
  handler: (request: NextRequest, user: TokenPayload) => Promise<NextResponse>,
  options?: {
    roles?: UserRole[];
  }
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Authenticate request
      const user = await authenticateRequest(request);

      // Check roles if specified
      if (options?.roles) {
        checkRole(user, options.roles);
      }

      // Call the actual handler
      return await handler(request, user);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      }

      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 403 }
        );
      }

      logger.error('Auth middleware error', error instanceof Error ? error : new Error(String(error)));
      return NextResponse.json(
        { success: false, error: 'Terjadi kesalahan saat memverifikasi autentikasi.' },
        { status: 500 }
      );
    }
  };
}

/**
 * Optional auth - tidak throw error jika tidak ada token, tapi tetap decode jika ada
 */
export async function optionalAuth(request: NextRequest): Promise<TokenPayload | null> {
  const token = extractToken(request);

  if (!token) {
    return null;
  }

  try {
    return verifyToken(token);
  } catch (error) {
    logger.debug('Optional auth: Invalid token', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}
