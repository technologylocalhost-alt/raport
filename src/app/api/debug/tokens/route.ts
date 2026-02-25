import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const tokens = await prisma.refreshToken.findMany({
      include: {
        user: {
          select: {
            email: true,
            name: true,
            role: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      count: tokens.length,
      tokens: tokens.map(token => ({
        id: token.id,
        userEmail: token.user.email,
        userName: token.user.name,
        userRole: token.user.role,
        tokenPreview: token.token.substring(0, 30) + '...',
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
      }))
    });
  } catch (error) {
    console.error('[Debug] Token error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tokens', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
