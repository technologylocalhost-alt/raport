import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subjectId: string }> }
) {
  try {
    const { subjectId } = await params;

    // Verify token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const teacher = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!teacher || teacher.role !== 'TEACHER') {
      return NextResponse.json(
        { success: false, error: 'Not a teacher' },
        { status: 403 }
      );
    }

    // Get all classes where this teacher teaches the specified subject
    const classTeachers = await prisma.classTeacher.findMany({
      where: {
        teacherId: teacher.id,
        subjectId: subjectId,
      },
      include: {
        class: {
          include: {
            students: {
              select: {
                id: true,
                name: true,
                studentNo: true,
              },
              orderBy: {
                name: 'asc',
              },
            },
          },
        },
      },
    });

    if (classTeachers.length === 0) {
      return NextResponse.json(
        { 
          success: true, 
          data: [],
          message: 'No classes found for this subject'
        }
      );
    }

    // Collect all unique students from all classes for this subject
    const studentMap = new Map<string, { id: string; name: string; nisn: string }>();
    
    classTeachers.forEach((ct) => {
      ct.class.students.forEach((student) => {
        if (!studentMap.has(student.id)) {
          studentMap.set(student.id, {
            id: student.id,
            name: student.name,
            nisn: student.studentNo,
          });
        }
      });
    });

    const students = Array.from(studentMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return NextResponse.json({
      success: true,
      data: students,
      total: students.length,
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch students' },
      { status: 500 }
    );
  }
}
