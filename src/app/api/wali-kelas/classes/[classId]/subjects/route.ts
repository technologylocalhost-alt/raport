import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);

    if (!payload) {
      return NextResponse.json({ error: 'Token invalid' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || (user.role !== 'WALI_KELAS' && user.role !== 'ADMIN' && user.role !== 'PRINCIPAL')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { classId } = await params;

    // Get all subjects for the class
    const subjects = await prisma.subject.findMany({
      where: {
        classSubjects: {
          some: {
            classId: classId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
        nameArabic: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: subjects,
    });
  } catch (error) {
    console.error('Error fetching class subjects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
