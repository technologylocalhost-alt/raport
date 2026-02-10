import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subjectId: string }> }
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

    const { subjectId } = await params;

    // Verify that the teacher teaches this subject
    const teacherSubject = await prisma.classTeacher.findFirst({
      where: {
        teacherId: decoded.userId,
        subjectId: subjectId,
      },
    });

    if (!teacherSubject) {
      return NextResponse.json(
        { success: false, message: 'Anda tidak authorized untuk subject ini' },
        { status: 403 }
      );
    }

    // Get competencies for this subject
    const competencies = await prisma.competency.findMany({
      where: {
        subjectId: subjectId,
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      competencies: competencies.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        subjectId: c.subjectId,
        subjectName: c.subject.name,
        subjectCode: c.subject.code,
        type: c.type,
      })),
    });
  } catch (error) {
    console.error('Error fetching competencies:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memuat kompetensi' },
      { status: 500 }
    );
  }
}
