import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTeacherOnly } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subjectId: string }> }
) {
  try {
    const teacher = await requireTeacherOnly(request);
    if (!teacher) {
      return NextResponse.json(
        { success: false, message: 'Token tidak valid atau expired' },
        { status: 401 }
      );
    }

    const { subjectId } = await params;

    // Validation: Check subjectId format
    if (!subjectId || subjectId.trim() === '') {
      return NextResponse.json(
        { success: false, message: 'ID Mata Pelajaran tidak valid' },
        { status: 400 }
      );
    }

    // Validation: Verify subject exists
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      return NextResponse.json(
        { success: false, message: 'Mata Pelajaran tidak ditemukan' },
        { status: 404 }
      );
    }

    // Validation: Verify that the teacher teaches this subject
    const teacherSubject = await prisma.classTeacher.findFirst({
      where: {
        teacherId: teacher.id,
        subjectId: subjectId,
      },
    });

    if (!teacherSubject) {
      return NextResponse.json(
        { success: false, message: 'Anda tidak memiliki akses untuk mata pelajaran ini' },
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
    serverError('Error fetching competencies:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memuat data kompetensi. Silakan coba lagi' },
      { status: 500 }
    );
  }
}
