import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
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
        teacherId: decoded.userId,
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
        teacherId: decoded.userId,
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
    console.error('Error creating competency:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menambahkan kompetensi' },
      { status: 500 }
    );
  }
}
