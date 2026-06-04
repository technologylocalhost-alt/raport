import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { requireTeacherOnly } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

async function requireTeacherAccess(req: NextRequest) {
  return requireTeacherOnly(req);
}

/**
 * GET /api/teacher/grades/options
 * Get available students and competencies for the current teacher
 */
export async function GET(request: NextRequest) {
  try {
    const teacher = await requireTeacherAccess(request);
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
    serverError('Get options error:', error);
    return errorResponse('Failed to fetch options', 500);
  }
}
