import { NextRequest, NextResponse } from 'next/server';
import { extractRefreshTokenFromCookies } from '@/lib/auth/utils';
import { extractAccessToken } from '@/lib/auth/token-extractor';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { clearAuthCookies, setNoStoreHeaders } from '@/lib/auth/cookies';
import { rateLimit, rateLimitPresets } from '@/middleware/rateLimit';
import { serverError } from '@/lib/server-log';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit({
      ...rateLimitPresets.moderate,
      maxRequests: 20,
      windowMs: 5 * 60 * 1000,
      message: 'Terlalu banyak permintaan logout. Silakan coba lagi beberapa menit lagi.',
    })(request);
    if (rateLimitResponse) return rateLimitResponse;
    // Extract user from token for activity logging
    let userId: string | null = null;
    try {
      const accessToken = extractAccessToken(request);
      if (accessToken) {
        const payload = verifyAccessToken(accessToken);
        userId = payload?.userId || null;
      }
    } catch {
    }

    // Get refresh token from cookies
    const refreshToken = extractRefreshTokenFromCookies(request);

    // Create response FIRST (don't wait for DB)
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    clearAuthCookies(response);
    setNoStoreHeaders(response);

    // Log logout activity if we have userId
    if (userId) {
      await logActivity({
        userId,
        action: 'LOGOUT',
        resourceType: 'User',
        resourceId: userId,
        description: 'User logged out',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'SUCCESS',
      });
    }

    // Delete refresh token from database in background (fire and forget)
    if (refreshToken) {
      prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      }).catch((error) => {
        serverError('[Logout Route] Failed to delete refresh token:', error);
      });
    }

    return response;
  } catch (error) {
    serverError('[Logout Route] Error:', error);
    const response = NextResponse.json(
      { success: true, message: 'Logged out' },
      { status: 200 }
    );
    clearAuthCookies(response);
    setNoStoreHeaders(response);
    return response;
  }
}
