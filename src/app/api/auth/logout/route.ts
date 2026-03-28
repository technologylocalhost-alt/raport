import { NextRequest, NextResponse } from 'next/server';
import { extractRefreshTokenFromCookies } from '@/lib/auth/utils';
import { extractAccessToken } from '@/lib/auth/token-extractor';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';

export async function POST(request: NextRequest) {
  console.log('[Logout Route] POST request received');
  
  try {
    // Extract user from token for activity logging
    let userId: string | null = null;
    try {
      const accessToken = extractAccessToken(request);
      if (accessToken) {
        const payload = verifyAccessToken(accessToken);
        userId = payload?.userId || null;
      }
    } catch (error) {
      console.log('[Logout Route] Could not extract user from token');
    }

    // Get refresh token from cookies
    const refreshToken = extractRefreshTokenFromCookies(request);
    console.log('[Logout Route] Refresh token from cookies:', !!refreshToken);

    // Create response FIRST (don't wait for DB)
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    // Clear BOTH cookies (accessToken and refreshToken)
    response.cookies.set('accessToken', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_URL?.includes('localhost'),
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    response.cookies.set('refreshToken', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_URL?.includes('localhost'),
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    console.log('[Logout Route] Cookies cleared, returning response');

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
      }).then(() => {
        console.log('[Logout Route] Refresh token deleted from DB');
      }).catch((error) => {
        console.error('[Logout Route] Failed to delete refresh token:', error);
      });
    }

    return response;
  } catch (error) {
    console.error('[Logout Route] Error:', error);
    return NextResponse.json(
      { success: true, message: 'Logged out' },
      { status: 200 }
    );
  }
}
