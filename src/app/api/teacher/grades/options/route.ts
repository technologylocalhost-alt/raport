import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';

async function getTeacher(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    return null;
  }

  const teacher = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (teacher && teacher.role === 'TEACHER') {
    return teacher;
  }
  return null;
}

/**
 * GET /api/teacher/grades/options
 * Get available students and competencies for the current teacher
 */
export async function GET(request: NextRequest) {
  try {
    const teacher = await getTeacher(request);
    if (!teacher) {
      return errorResponse('Unauthorized', 401);
    }

    // Get students from classes taught by this teacher
    const classTeachers = await prisma.classTeacher.findMany({
      where: { teacherId: teacher.id },
      include: {
        class: {
          include: {
            students: {
              select: {
                id: true,
                name: true,
              },
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    });

    // Collect unique students
    const uniqueStudents = new Map();
    classTeachers.forEach((ct) => {
      ct.class.students.forEach((student) => {
        if (!uniqueStudents.has(student.id)) {
          uniqueStudents.set(student.id, {
            id: student.id,
            name: student.name,
          });
        }
      });
    });

    const students = Array.from(uniqueStudents.values());

    // Get competencies for subjects taught by this teacher
    const competencies = await prisma.competency.findMany({
      where: {
        subject: {
          teachers: {
            some: {
              teacherId: teacher.id,
            },
          },
        },
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ subject: { name: 'asc' } }, { name: 'asc' }],
    });

    return successResponse({
      students,
      competencies: competencies.map((c) => ({
        id: c.id,
        name: c.name,
        subjectId: c.subjectId,
        subjectName: c.subject.name,
      })),
    });
  } catch (error) {
    console.error('Get options error:', error);
    return errorResponse('Failed to fetch options', 500);
  }
}
