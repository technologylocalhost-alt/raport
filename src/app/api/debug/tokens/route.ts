import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth/access';
import { serverError } from '@/lib/server-log';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokens = await prisma.refreshToken.findMany({
      include: {
        user: {
          select: {
            email: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      count: tokens.length,
      tokens: tokens.map((token) => ({
        id: token.id,
        userEmail: token.user.email,
        userName: token.user.name,
        userRole: token.user.role,
        tokenPreview: `${token.token.substring(0, 12)}...`,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
      })),
    });
  } catch (error) {
    serverError('[Debug] Token error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tokens' },
      { status: 500 }
    );
  }
}
