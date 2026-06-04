import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTeacherOnly } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

export async function GET(request: NextRequest) {
  try {
    const teacher = await requireTeacherOnly(request);
    if (!teacher) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get all classes where teacher has students (from ClassTeacher)
    const classTeachers = await prisma.classTeacher.findMany({
      where: {
        teacherId: teacher.id,
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Get unique classes
    const uniqueClassesMap = new Map();
    const uniqueSubjectsMap = new Map();

    classTeachers.forEach((ct) => {
      if (ct.class && ct.class.id) {
        uniqueClassesMap.set(ct.class.id, ct.class);
      }
      if (ct.subject && ct.subject.id) {
        uniqueSubjectsMap.set(ct.subject.id, ct.subject);
      }
    });

    const classes = Array.from(uniqueClassesMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    const subjects = Array.from(uniqueSubjectsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return NextResponse.json({
      success: true,
      classes,
      subjects,
    });
  } catch (error) {
    serverError('Error fetching filter options:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memuat opsi filter' },
      { status: 500 }
    );
  }
}
