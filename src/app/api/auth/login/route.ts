import { NextRequest, NextResponse } from 'next/server';
import { comparePassword } from '@/lib/auth/password';
import { generateTokens } from '@/lib/auth/jwt';
import { parseExpiryString, getTokenExpiryDate } from '@/lib/auth/utils';
import { prisma } from '@/lib/db';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { clearAuthCookies, setAccessTokenCookie, setNoStoreHeaders, setRefreshTokenCookie } from '@/lib/auth/cookies';
import { rateLimit, rateLimitPresets } from '@/middleware/rateLimit';
import { z } from 'zod';
import { serverError } from '@/lib/server-log';

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

interface PrismaKnownError extends Error {
  code?: string;
  meta?: unknown;
}

interface RefreshTokenCreateError {
  code?: string;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(rateLimitPresets.strict)(request);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();

    // Validate input
    const validatedData = loginSchema.parse(body);
    const { email, password } = validatedData;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        bagianList: { select: { bagian: true } },
      },
    });

    if (!user || !user.isActive) {
      // Log failed login attempt
      await logActivity({
        userId: 'SYSTEM', // Use SYSTEM for failed login since user doesn't exist
        action: 'LOGIN',
        resourceType: 'User',
        description: `Failed login attempt for email: ${email}`,
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
        errorMessage: 'User not found or inactive',
      });

      const response = NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
      setNoStoreHeaders(response);
      clearAuthCookies(response);
      return response;
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      // Log failed login attempt
      await logActivity({
        userId: user.id,
        action: 'LOGIN',
        resourceType: 'User',
        resourceId: user.id,
        resourceName: user.email,
        description: `Failed login attempt - invalid password`,
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
        errorMessage: 'Invalid password',
      });

      const response = NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
      setNoStoreHeaders(response);
      clearAuthCookies(response);
      return response;
    }

    // Extract bagian list
    const userBagian = user.bagianList.map((b) => b.bagian);

    // Generate tokens
    const { accessToken, refreshToken: initialRefreshToken } = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      bagian: userBagian,
    });

    // Save refresh token to database
    const refreshTokenExpiry = parseExpiryString(process.env.JWT_REFRESH_EXPIRY || '7d');
    const expiresAt = getTokenExpiryDate(refreshTokenExpiry);

    // Delete expired refresh tokens for this user first to avoid conflicts
    await prisma.refreshToken.deleteMany({
      where: {
        userId: user.id,
      },
    });

    // Then create new refresh token with retry logic for concurrent requests
    let refreshToken = initialRefreshToken;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        await prisma.refreshToken.create({
          data: {
            userId: user.id,
            token: refreshToken,
            expiresAt,
          },
        });
        break; // Success, exit loop
      } catch (err) {
        const createError = err as RefreshTokenCreateError;
        if (createError?.code === 'P2002' && retryCount < maxRetries - 1) {
          retryCount++;
          const newTokens = generateTokens({
            userId: user.id,
            email: user.email,
            role: user.role,
            bagian: userBagian,
          });
          refreshToken = newTokens.refreshToken;
          continue;
        }
        throw err; // Rethrow if not a retry-able error or max retries reached
      }
    }

    // Create response with secure cookie
    const response = NextResponse.json({
      success: true,
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        schoolId: user.schoolId,
        bagian: userBagian,
      },
    });

    // Keep returning accessToken for now because the current frontend still depends on localStorage.
    // Cookies are the canonical server-side session transport.
    setAccessTokenCookie(response, accessToken, 36000);
    setRefreshTokenCookie(response, refreshToken, refreshTokenExpiry / 1000);
    setNoStoreHeaders(response);

    // Log successful login
    await logActivity({
      userId: user.id,
      action: 'LOGIN',
      resourceType: 'User',
      resourceId: user.id,
      resourceName: user.email,
      description: `Successful login`,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const response = NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
      setNoStoreHeaders(response);
      return response;
    }

    // Handle specific Prisma errors
    if (error instanceof Error && error.name === 'PrismaClientKnownRequestError') {
      const prismaError = error as PrismaKnownError;
      if (prismaError.code === 'P2002') {
        serverError('Unique constraint error during refresh token creation:', {
          code: prismaError.code,
          meta: prismaError.meta,
        });
        // Return 500 as this is a server-side issue that should be investigated
        const response = NextResponse.json(
          { error: 'Authentication service temporarily unavailable' },
          { status: 500 }
        );
        setNoStoreHeaders(response);
        clearAuthCookies(response);
        return response;
      }
    }

    serverError('Login error:', error);
    const response = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    setNoStoreHeaders(response);
    clearAuthCookies(response);
    return response;
  }
}
