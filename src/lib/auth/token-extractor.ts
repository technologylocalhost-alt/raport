import { NextRequest } from 'next/server';

/**
 * Extract token from request (cookie or Authorization header)
 * Priority: Authorization header > accessToken cookie
 */
export function extractAccessToken(request: NextRequest): string | null {
  // Try Authorization header first (Bearer token)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7); // Remove "Bearer " prefix
  }

  // Try accessToken cookie
  const accessTokenCookie = request.cookies.get('accessToken')?.value;
  if (accessTokenCookie) {
    return accessTokenCookie;
  }

  return null;
}

/**
 * Extract refresh token from cookies
 */
export function extractRefreshToken(request: NextRequest): string | null {
  return request.cookies.get('refreshToken')?.value || null;
}
