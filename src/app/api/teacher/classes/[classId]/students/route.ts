import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTeacherOrWaliKelas } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const user = await requireTeacherOrWaliKelas(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Token tidak valid atau expired' },
        { status: 401 }
      );
    }

    const { classId } = await params;

    // Validation: Check classId format (simple validation)
    if (!classId || classId.trim() === '') {
      return NextResponse.json(
        { success: false, message: 'ID Kelas tidak valid' },
        { status: 400 }
      );
    }


    // Validation: Verify teacher has access to this class
    let isAuthorized = false;

    if (user.role === 'TEACHER') {
      // Teacher must be assigned to this class
      const classTeacher = await prisma.classTeacher.findFirst({
        where: {
          teacherId: user.id,
          classId: classId,
        },
      });
      isAuthorized = !!classTeacher;
    } else if (user.role === 'WALI_KELAS') {
      // Wali-kelas must be assigned to this class
      const waliBelongsToClass = await prisma.class.findFirst({
        where: {
          id: classId,
          waliKelasId: user.id,
        },
      });
      isAuthorized = !!waliBelongsToClass;
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, message: 'Anda tidak memiliki akses ke kelas ini' },
        { status: 403 }
      );
    }

    // Validation: Check class exists
    const classExists = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classExists) {
      return NextResponse.json(
        { success: false, message: 'Kelas tidak ditemukan' },
        { status: 404 }
      );
    }

    // Fetch students in the class
    const students = await prisma.student.findMany({
      where: {
        classId: classId,
      },
      select: {
        id: true,
        name: true,
        studentNo: true,
        email: true,
        phone: true,
        class: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        { nourut: { sort: 'asc', nulls: 'last' } },
        { name: 'asc' },
      ],
    });

    // Transform the data to include className
    const transformedStudents = students.map((student) => ({
      id: student.id,
      name: student.name,
      nisn: student.studentNo,
      email: student.email,
      phone: student.phone,
      className: student.class?.name || '',
    }));

    // Validate response data
    if (!Array.isArray(transformedStudents)) {
      return NextResponse.json(
        { success: false, message: 'Format data tidak valid' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: transformedStudents,
    });
  } catch (error) {
    serverError('Error fetching class students:', error);
    // Don't expose internal error details
    return NextResponse.json(
      { success: false, message: 'Gagal memuat data siswa. Silakan coba lagi' },
      { status: 500 }
    );
  }
}
