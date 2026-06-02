import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from './jwt';
import { extractAccessToken } from './token-extractor';
import { TokenPayload } from '@/types';

/**
 * Verify request has valid access token
 * Returns user payload or null if invalid
 */
export function verifyRequest(request: NextRequest): TokenPayload | null {
  const token = extractAccessToken(request);
  
  if (!token) {
    console.warn('[Auth] No token found in request');
    return null;
  }

  const payload = verifyAccessToken(token);
  return payload;
}

/**
 * API route wrapper with automatic auth verification
 * Extracts and verifies token, passes user payload to handler
 */
export function withAuth<T>(
  handler: (
    request: NextRequest,
    user: TokenPayload
  ) => Promise<NextResponse<T> | NextResponse>
) {
  return async (request: NextRequest) => {
    try {
      const user = verifyRequest(request);

      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized: Invalid or missing token' },
          { status: 401 }
        );
      }

      return await handler(request, user);
    } catch (error) {
      console.error('[Auth Middleware Error]', error);
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 401 }
      );
    }
  };
}
