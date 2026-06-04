import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTeacherOnly } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

export async function POST(request: NextRequest) {
  try {
    const teacher = await requireTeacherOnly(request);
    if (!teacher) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    const { name, code, subjectId, type } = await request.json();

    // Validate required fields
    if (!name || !subjectId || !type) {
      return NextResponse.json(
        { success: false, message: 'Nama, Mata Pelajaran, dan Tipe wajib diisi' },
        { status: 400 }
      );
    }

    // Verify that the subject belongs to the teacher
    const teacherSubject = await prisma.classTeacher.findFirst({
      where: {
        teacherId: teacher.id,
        subjectId: subjectId,
      },
    });

    if (!teacherSubject) {
      return NextResponse.json(
        { success: false, message: 'Anda tidak authorized untuk mata pelajaran ini' },
        { status: 403 }
      );
    }

    // Create competency
    const competency = await prisma.competency.create({
      data: {
        name,
        code: code || '',
        subjectId,
        teacherId: teacher.id,
        type,
      },
      include: {
        subject: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Kompetensi berhasil ditambahkan',
      data: {
        id: competency.id,
        name: competency.name,
        code: competency.code,
        subjectName: competency.subject?.name || '',
        subjectCode: competency.subject?.code || '',
      },
    });
  } catch (error) {
    serverError('Error creating competency:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menambahkan kompetensi' },
      { status: 500 }
    );
  }
}
