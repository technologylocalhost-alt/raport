import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const subjectId = request.nextUrl.searchParams.get('subjectId');

    // Get grades for this student
    const gradesQueryWhere: any = {
      studentId: id,
    };

    // Filter by subject if provided
    if (subjectId) {
      gradesQueryWhere.subjectId = subjectId;
    }

    const grades = await prisma.grade.findMany({
      where: gradesQueryWhere,
      include: {
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
        competency: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      grades: grades.map((g) => ({
        id: g.id,
        competencyName: g.competency?.name || '(Tanpa Kompetensi)',
        competencyCode: g.competency?.code || '',
        score: g.score,
        assessmentType: g.assessmentType,
        notes: g.notes,
        createdAt: g.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching grades:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memuat nilai' },
      { status: 500 }
    );
  }
}
