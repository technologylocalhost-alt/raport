import { NextRequest, NextResponse } from 'next/server';
import { extractRefreshTokenFromCookies } from '@/lib/auth/utils';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Get refresh token from cookies
    const refreshToken = extractRefreshTokenFromCookies(request);

    if (refreshToken) {
      // Delete refresh token from database (revoke it)
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    // Clear refresh token cookie
    response.cookies.set('refreshToken', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
