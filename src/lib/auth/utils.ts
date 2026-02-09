import { NextRequest } from 'next/server';

/**
 * Extract token from Authorization header (Bearer token)
 */
export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice(7); // Remove "Bearer " prefix
}

/**
 * Extract token from cookies
 */
export function extractRefreshTokenFromCookies(request: NextRequest): string | null {
  return request.cookies.get('refreshToken')?.value || null;
}

/**
 * Get token expiry date as Date object
 */
export function getTokenExpiryDate(expiresIn: number): Date {
  return new Date(Date.now() + expiresIn);
}

/**
 * Parse expiry string (e.g., "15m", "7d") to milliseconds
 */
export function parseExpiryString(expiryStr: string): number {
  const match = expiryStr.match(/^(\d+)([smhd])$/i);
  if (!match) return 15 * 60 * 1000; // Default to 15 minutes

  const [, amount, unit] = match;
  const value = parseInt(amount, 10);

  const unitMap: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * (unitMap[unit.toLowerCase()] || 60 * 1000);
}
