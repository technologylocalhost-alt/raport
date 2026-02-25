import { NextRequest, NextResponse } from 'next/server';
import { extractRefreshTokenFromCookies } from '@/lib/auth/utils';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  console.log('[Logout Route] POST request received');
  
  try {
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
