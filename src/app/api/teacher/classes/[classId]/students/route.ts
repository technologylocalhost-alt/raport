import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    // Validation: Check token
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Token tidak ditemukan' },
        { status: 401 }
      );
    }

    // Validation: Verify token
    const decoded = verifyAccessToken(token);
    if (!decoded || !decoded.userId) {
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

    // Verify user is a teacher
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || (user.role !== 'TEACHER' && user.role !== 'WALI_KELAS')) {
      return NextResponse.json(
        { success: false, message: 'Anda tidak memiliki akses' },
        { status: 403 }
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
    console.error('Error fetching class students:', error);
    // Don't expose internal error details
    return NextResponse.json(
      { success: false, message: 'Gagal memuat data siswa. Silakan coba lagi' },
      { status: 500 }
    );
  }
}
