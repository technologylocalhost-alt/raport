import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decoded = verifyAccessToken(token);
    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    // Verify user has WALI_KELAS role
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true },
    });

    if (!user || user.role !== 'WALI_KELAS') {
      return NextResponse.json(
        { success: false, message: 'Forbidden: Only WALI_KELAS can access this' },
        { status: 403 }
      );
    }

    // Get subjectId from query parameters
    const subjectId = request.nextUrl.searchParams.get('subjectId');

    if (!subjectId) {
      return NextResponse.json(
        { success: false, message: 'subjectId query parameter is required' },
        { status: 400 }
      );
    }

    // Get competencies for the specific subject
    const competencies = await prisma.competency.findMany({
      where: {
        subjectId: subjectId,
      },
      select: {
        id: true,
        name: true,
        code: true,
        subjectId: true,
        type: true,
        subject: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Transform the data
    const transformedCompetencies = competencies.map((comp) => ({
      id: comp.id,
      name: comp.name,
      code: comp.code,
      subjectId: comp.subjectId,
      type: comp.type,
      subjectName: comp.subject?.name || '',
      subjectCode: comp.subject?.code || '',
    }));

    return NextResponse.json({
      success: true,
      competencies: transformedCompetencies,
      total: transformedCompetencies.length,
    });
  } catch (error) {
    console.error('Error fetching wali-kelas competencies:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch competencies' },
      { status: 500 }
    );
  }
}
