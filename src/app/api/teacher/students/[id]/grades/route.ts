import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTeacherWaliAdminPrincipal } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireTeacherWaliAdminPrincipal(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const subjectId = request.nextUrl.searchParams.get('subjectId');

    // Get grades for this student
    const gradesQueryWhere: Record<string, unknown> = {
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
    serverError('Error fetching grades:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memuat nilai' },
      { status: 500 }
    );
  }
}
