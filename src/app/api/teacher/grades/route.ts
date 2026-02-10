import { NextRequest } from 'next/server';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth/jwt';

const gradeSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  competencyId: z.string().min(1, 'Competency ID is required'),
  score: z
    .union([z.string(), z.number()])
    .transform((val) => parseFloat(String(val)))
    .refine((val) => !isNaN(val) && val >= 0 && val <= 100, {
      message: 'Score must be a number between 0 and 100',
    }),
  assessmentType: z.enum([
    'QUIZ',
    'MIDTERM',
    'FINAL',
    'TASK',
    'PROJECT',
    'DAILY',
  ]),
  notes: z.string().optional(),
});

async function getUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (user && (user.role === 'TEACHER' || user.role === 'WALI_KELAS')) {
    return user;
  }
  return null;
}

/**
 * GET /api/teacher/grades
 * Get grades for the current teacher/wali-kelas with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const pageParam = parseInt(searchParams.get('page') || '1');
    const page = isNaN(pageParam) ? 1 : pageParam;
    const limitParam = parseInt(searchParams.get('limit') || '10');
    const limit = isNaN(limitParam) ? 10 : limitParam;
    const search = searchParams.get('search') || '';
    const classId = searchParams.get('classId') || '';
    const subjectId = searchParams.get('subjectId') || '';
    const assessmentType = searchParams.get('assessmentType') || '';
    const studentId = searchParams.get('studentId') || '';

    const skip = Math.max(0, (page - 1) * limit);

    // Build where clause
    const whereClause: any = {};

    // Teachers can only see their own grades; wali-kelas can see grades for their classes
    if (user.role === 'TEACHER') {
      whereClause.teacher = {
        id: user.id,
      };
    } else if (user.role === 'WALI_KELAS' && classId) {
      // Wali-kelas can only see grades for their classes
      whereClause.student = {
        classId: classId,
        class: {
          waliKelasId: user.id,
        },
      };
    } else if (user.role === 'WALI_KELAS') {
      // If no classId specified for wali-kelas, reject
      return errorResponse('classId is required for wali-kelas', 400);
    }

    // Apply additional filters
    if (search) {
      whereClause.OR = [
        { student: { name: { contains: search, mode: 'insensitive' } } },
        { competency: { name: { contains: search, mode: 'insensitive' } } },
        { competency: { subject: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    // Apply studentId filter for both TEACHER and WALI_KELAS
    if (studentId && (user.role === 'TEACHER' || user.role === 'WALI_KELAS')) {
      whereClause.studentId = studentId;
    }

    if (subjectId) {
      if (!whereClause.competency) whereClause.competency = {};
      whereClause.competency.subjectId = subjectId;
    }

    if (assessmentType) {
      whereClause.assessmentType = assessmentType;
    }

    const grades = await prisma.grade.findMany({
      where: whereClause,
      include: {
        student: {
          include: {
            class: true,
          },
        },
        competency: {
          include: {
            subject: true,
          },
        },
        teacher: true,
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.grade.count({ where: whereClause });

    return paginatedResponse(
      grades.map((g: any) => ({
        id: g.id,
        studentId: g.studentId,
        studentName: g.student.name,
        studentNo: g.student.studentNo || '-',
        studentNisn: g.student.studentNo || '-',
        className: g.student.class?.name || '-',
        competencyId: g.competencyId,
        competencyName: g.competency.name,
        subjectName: g.competency.subject.name,
        score: g.score,
        assessmentType: g.assessmentType,
        teacherId: g.teacherId,
        teacherName: g.teacher?.name || '-',
        notes: g.notes || '',
        date: g.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      })),
      total,
      page,
      limit
    );
  } catch (error) {
    console.error('Get grades error:', error);
    return errorResponse('Failed to fetch grades', 500);
  }
}

/**
 * POST /api/teacher/grades
 * Create a new grade
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user || user.role !== 'TEACHER') {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const validatedData = gradeSchema.parse(body);

    // Verify that student exists in a class taught by this teacher
    const classTeacher = await prisma.classTeacher.findFirst({
      where: {
        teacherId: user.id,
        class: {
          students: {
            some: {
              id: validatedData.studentId,
            },
          },
        },
      },
    });

    if (!classTeacher) {
      return errorResponse('Student not found in your classes', 400);
    }

    // Verify that competency exists
    const competency = await prisma.competency.findUnique({
      where: { id: validatedData.competencyId },
      include: {
        subject: true,
      },
    });

    if (!competency) {
      return errorResponse('Competency not found', 404);
    }

    const grade = await prisma.grade.create({
      data: {
        studentId: validatedData.studentId,
        competencyId: validatedData.competencyId,
        score: String(validatedData.score),
        assessmentType: validatedData.assessmentType,
        notes: validatedData.notes,
        teacherId: user.id,
        levelId: competency.subject.levelId || '',
        scoringType: 'NUMERIC_0_100',
      },
      include: {
        student: true,
        competency: {
          include: {
            subject: true,
          },
        },
      },
    });

    return successResponse({
      id: grade.id,
      studentId: grade.studentId,
      studentName: grade.student.name,
      competencyId: grade.competencyId,
      competencyName: grade.competency.name,
      subjectName: grade.competency.subject.name,
      score: grade.score,
      assessmentType: grade.assessmentType,
      notes: grade.notes || '',
      date: grade.createdAt?.toISOString().split('T')[0],
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return errorResponse('Validation error', 400, fieldErrors);
    }
    console.error('Create grade error:', error);
    return errorResponse('Failed to create grade', 500);
  }
}
