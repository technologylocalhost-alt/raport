import { NextRequest, NextResponse } from 'next/server';
import { comparePassword } from '@/lib/auth/password';
import { generateTokens } from '@/lib/auth/jwt';
import { parseExpiryString, getTokenExpiryDate } from '@/lib/auth/utils';
import { prisma } from '@/lib/db';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { z } from 'zod';

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginInput = z.infer<typeof loginSchema>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = loginSchema.parse(body);
    const { email, password } = validatedData;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
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

      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
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

      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate tokens
    const { accessToken, refreshToken: initialRefreshToken } = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
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
      } catch (err: any) {
        // If unique constraint error, regenerate token and retry
        if (err?.code === 'P2002' && retryCount < maxRetries - 1) {
          retryCount++;
          const newTokens = generateTokens({
            userId: user.id,
            email: user.email,
            role: user.role,
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
      },
    });

    // Set access token as HttpOnly cookie
    response.cookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_APP_URL?.startsWith('https'),
      sameSite: 'lax',
      maxAge: 3600, // 1 hour
      path: '/',
    });

    // Set refresh token as HttpOnly secure cookie
    response.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_APP_URL?.startsWith('https'),
      sameSite: 'lax',
      maxAge: refreshTokenExpiry / 1000, // Convert to seconds
      path: '/',
    });

    // Add cache control headers to prevent caching issues
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

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
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    // Handle specific Prisma errors
    if (error instanceof Error && error.name === 'PrismaClientKnownRequestError') {
      const prismaError = error as any;
      if (prismaError.code === 'P2002') {
        console.error('Unique constraint error during refresh token creation:', {
          code: prismaError.code,
          meta: prismaError.meta,
        });
        // Return 500 as this is a server-side issue that should be investigated
        return NextResponse.json(
          { error: 'Authentication service temporarily unavailable' },
          { status: 500 }
        );
      }
    }

    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
