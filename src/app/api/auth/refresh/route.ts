import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken } from '@/lib/auth/jwt';
import { generateTokens } from '@/lib/auth/jwt';
import { extractRefreshTokenFromCookies } from '@/lib/auth/utils';
import { prisma } from '@/lib/db';
import { clearAuthCookies, setAccessTokenCookie, setNoStoreHeaders } from '@/lib/auth/cookies';
import { rateLimit, rateLimitPresets } from '@/middleware/rateLimit';
import { serverError } from '@/lib/server-log';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit({
      ...rateLimitPresets.strict,
      maxRequests: 10,
      windowMs: 5 * 60 * 1000,
      message: 'Terlalu banyak percobaan refresh token. Silakan coba lagi beberapa menit lagi.',
    })(request);
    if (rateLimitResponse) return rateLimitResponse;

    // Get refresh token from cookies
    const refreshToken = extractRefreshTokenFromCookies(request);

    if (!refreshToken) {
      // Clear any existing cookies
      const response = NextResponse.json(
        { success: false, error: 'Missing refresh token', shouldLogout: true },
        { status: 401 }
      );
      clearAuthCookies(response);
      setNoStoreHeaders(response);
      return response;
    }

    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);

    if (!payload) {
      // Clear cookies
      const response = NextResponse.json(
        { success: false, error: 'Invalid or expired refresh token', shouldLogout: true },
        { status: 401 }
      );
      clearAuthCookies(response);
      setNoStoreHeaders(response);
      return response;
    }

    // Check if refresh token exists in database and is not revoked
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || new Date() > storedToken.expiresAt) {
      // Clear cookies and revoke token if exists
      if (storedToken) {
        await prisma.refreshToken.delete({
          where: { token: refreshToken },
        }).catch((error) => serverError('[Refresh] Failed to delete token:', error));
      }
      
      const response = NextResponse.json(
        { success: false, error: 'Refresh token expired or revoked', shouldLogout: true },
        { status: 401 }
      );
      clearAuthCookies(response);
      setNoStoreHeaders(response);
      return response;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.isActive) {
      const response = NextResponse.json(
        { success: false, error: 'User not found or inactive', shouldLogout: true },
        { status: 401 }
      );
      clearAuthCookies(response);
      setNoStoreHeaders(response);
      return response;
    }

    // Generate new access token
    const { accessToken: newAccessToken } = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });


    const response = NextResponse.json({
      success: true,
      accessToken: newAccessToken,
    });

    setAccessTokenCookie(response, newAccessToken, 36000);
    setNoStoreHeaders(response);

    return response;
  } catch (error) {
    serverError('[Refresh] Token refresh error:', error);
    
    const response = NextResponse.json(
      { success: false, error: 'Internal server error', shouldLogout: true },
      { status: 500 }
    );
    clearAuthCookies(response);
    setNoStoreHeaders(response);
    return response;
  }
}

