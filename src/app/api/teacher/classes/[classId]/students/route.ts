import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
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

    const { classId } = await params;

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
      orderBy: {
        name: 'asc',
      },
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

    return NextResponse.json({
      success: true,
      data: transformedStudents,
    });
  } catch (error) {
    console.error('Error fetching class students:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch students' },
      { status: 500 }
    );
  }
}
