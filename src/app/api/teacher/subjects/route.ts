import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';

export async function GET(request: NextRequest) {
  try {
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

    // Get all subjects for this teacher through ClassTeacher relationship
    const classTeachers = await prisma.classTeacher.findMany({
      where: {
        teacherId: teacher.id,
      },
      include: {
        subject: {
          include: {
            level: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        class: {
          select: {
            id: true,
            name: true,
            level: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      distinct: ['subjectId'], // Avoid duplicate subjects
    });

    // Transform the data to match the expected format
    const subjects = classTeachers.map((ct) => ({
      id: ct.subject.id,
      name: ct.subject.name,
      code: ct.subject.code,
      description: ct.subject.description,
      level: ct.subject.level,
      class: ct.class,
    }));

    // Remove duplicates by subjectId
    const uniqueSubjects = Array.from(
      new Map(subjects.map((item) => [item.id, item])).values()
    );

    return NextResponse.json({
      success: true,
      data: uniqueSubjects,
      total: uniqueSubjects.length,
    });
  } catch (error) {
    console.error('Get teacher subjects error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subjects' },
      { status: 500 }
    );
  }
}

