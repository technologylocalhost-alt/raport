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
 * GET /api/teacher/grades
 * Get grades for the current teacher with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const teacher = await getTeacher(request);
    if (!teacher) {
      return errorResponse('Unauthorized', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {
      teacher: {
        id: teacher.id,
      },
    };

    if (search) {
      whereClause.OR = [
        { student: { name: { contains: search, mode: 'insensitive' } } },
        { competency: { name: { contains: search, mode: 'insensitive' } } },
        { competency: { subject: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const grades = await prisma.grade.findMany({
      where: whereClause,
      include: {
        student: true,
        competency: {
          include: {
            subject: true,
          },
        },
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
        competencyId: g.competencyId,
        competencyName: g.competency.name,
        subjectName: g.competency.subject.name,
        score: g.score,
        assessmentType: g.assessmentType,
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
    const teacher = await getTeacher(request);
    if (!teacher) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const validatedData = gradeSchema.parse(body);

    // Verify that student exists in a class taught by this teacher
    const classTeacher = await prisma.classTeacher.findFirst({
      where: {
        teacherId: teacher.id,
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
        teacherId: teacher.id,
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
