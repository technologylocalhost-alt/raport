import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken } from '@/lib/auth/jwt';
import { generateTokens } from '@/lib/auth/jwt';
import { extractRefreshTokenFromCookies } from '@/lib/auth/utils';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Get refresh token from cookies
    const refreshToken = extractRefreshTokenFromCookies(request);

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Missing refresh token' },
        { status: 401 }
      );
    }

    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 }
      );
    }

    // Check if refresh token exists in database and is not revoked
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || new Date() > storedToken.expiresAt) {
      return NextResponse.json(
        { error: 'Refresh token expired or revoked' },
        { status: 401 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'User not found or inactive' },
        { status: 401 }
      );
    }

    // Generate new access token
    const { accessToken: newAccessToken } = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return NextResponse.json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
