import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken } from '@/lib/auth/jwt';
import { generateTokens } from '@/lib/auth/jwt';
import { extractRefreshTokenFromCookies } from '@/lib/auth/utils';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('[Refresh] Token refresh requested');
    
    // Get refresh token from cookies
    const refreshToken = extractRefreshTokenFromCookies(request);

    if (!refreshToken) {
      console.warn('[Refresh] Missing refresh token');
      
      // Clear any existing cookies
      const response = NextResponse.json(
        { success: false, error: 'Missing refresh token', shouldLogout: true },
        { status: 401 }
      );
      
      response.cookies.delete('accessToken');
      response.cookies.delete('refreshToken');
      
      return response;
    }

    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);

    if (!payload) {
      console.warn('[Refresh] Invalid or expired refresh token');
      
      // Clear cookies
      const response = NextResponse.json(
        { success: false, error: 'Invalid or expired refresh token', shouldLogout: true },
        { status: 401 }
      );
      
      response.cookies.delete('accessToken');
      response.cookies.delete('refreshToken');
      
      return response;
    }

    // Check if refresh token exists in database and is not revoked
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || new Date() > storedToken.expiresAt) {
      console.warn('[Refresh] Refresh token expired or not found in database');
      
      // Clear cookies and revoke token if exists
      if (storedToken) {
        await prisma.refreshToken.delete({
          where: { token: refreshToken },
        }).catch(err => console.error('[Refresh] Failed to delete token:', err));
      }
      
      const response = NextResponse.json(
        { success: false, error: 'Refresh token expired or revoked', shouldLogout: true },
        { status: 401 }
      );
      
      response.cookies.delete('accessToken');
      response.cookies.delete('refreshToken');
      
      return response;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.isActive) {
      console.warn('[Refresh] User not found or inactive');
      
      const response = NextResponse.json(
        { success: false, error: 'User not found or inactive', shouldLogout: true },
        { status: 401 }
      );
      
      response.cookies.delete('accessToken');
      response.cookies.delete('refreshToken');
      
      return response;
    }

    // Generate new access token
    const { accessToken: newAccessToken } = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    console.log('[Refresh] Access token refreshed successfully for user:', user.id);

    const response = NextResponse.json({
      success: true,
      accessToken: newAccessToken,
    });

    // Set new access token cookie
    response.cookies.set('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 36000, // 10 hours
      path: '/',
    });

    // Add cache control headers to prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    console.error('[Refresh] Token refresh error:', error);
    
    const response = NextResponse.json(
      { success: false, error: 'Internal server error', shouldLogout: true },
      { status: 500 }
    );
    
    // Clear cookies on error
    response.cookies.delete('accessToken');
    response.cookies.delete('refreshToken');
    
    return response;
  }
}

