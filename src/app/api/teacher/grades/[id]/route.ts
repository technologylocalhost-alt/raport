import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth/jwt';

const gradeUpdateSchema = z.object({
  score: z
    .union([z.string(), z.number()])
    .transform((val) => parseFloat(String(val)))
    .refine((val) => !isNaN(val) && val >= 0 && val <= 100, {
      message: 'Score must be a number between 0 and 100',
    })
    .optional(),
  assessmentType: z.enum(['QUIZ', 'MIDTERM', 'FINAL', 'TASK', 'PROJECT', 'DAILY']).optional(),
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
 * GET /api/teacher/grades/[id]
 * Get a specific grade
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const teacher = await getTeacher(request);

    if (!teacher) {
      return errorResponse('Unauthorized', 401);
    }

    const grade = await prisma.grade.findUnique({
      where: { id },
      include: {
        student: true,
        competency: {
          include: {
            subject: true,
          },
        },
      },
    });

    if (!grade) {
      return errorResponse('Grade not found', 404);
    }

    if (grade.teacherId !== teacher.id) {
      return errorResponse('Unauthorized to view this grade', 403);
    }

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
    });
  } catch (error) {
    console.error('Get grade error:', error);
    return errorResponse('Failed to fetch grade', 500);
  }
}

/**
 * PUT /api/teacher/grades/[id]
 * Update a grade
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const teacher = await getTeacher(request);

    if (!teacher) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const validatedData = gradeUpdateSchema.parse(body);

    // Verify that the teacher owns this grade
    const grade = await prisma.grade.findUnique({
      where: { id },
    });

    if (!grade) {
      return errorResponse('Grade not found', 404);
    }

    if (grade.teacherId !== teacher.id) {
      return errorResponse('Unauthorized to update this grade', 403);
    }

    // Build update data, converting score to float if provided
    const updateData: any = {};
    if (validatedData.score !== undefined) {
      updateData.score = validatedData.score;
    }
    if (validatedData.assessmentType !== undefined) {
      updateData.assessmentType = validatedData.assessmentType;
    }
    if (validatedData.notes !== undefined) {
      updateData.notes = validatedData.notes;
    }

    const updatedGrade = await prisma.grade.update({
      where: { id },
      data: updateData,
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
      id: updatedGrade.id,
      studentId: updatedGrade.studentId,
      studentName: updatedGrade.student.name,
      competencyId: updatedGrade.competencyId,
      competencyName: updatedGrade.competency.name,
      subjectName: updatedGrade.competency.subject.name,
      score: updatedGrade.score,
      assessmentType: updatedGrade.assessmentType,
      notes: updatedGrade.notes || '',
      date: updatedGrade.createdAt?.toISOString().split('T')[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return errorResponse('Validation error', 400, fieldErrors);
    }
    console.error('Update grade error:', error);
    return errorResponse('Failed to update grade', 500);
  }
}

/**
 * DELETE /api/teacher/grades/[id]
 * Delete a grade
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const teacher = await getTeacher(request);

    if (!teacher) {
      return errorResponse('Unauthorized', 401);
    }

    // Verify that the teacher owns this grade
    const grade = await prisma.grade.findUnique({
      where: { id },
    });

    if (!grade) {
      return errorResponse('Grade not found', 404);
    }

    if (grade.teacherId !== teacher.id) {
      return errorResponse('Unauthorized to delete this grade', 403);
    }

    await prisma.grade.delete({
      where: { id },
    });

    return successResponse({ message: 'Grade deleted successfully' });
  } catch (error) {
    console.error('Delete grade error:', error);
    return errorResponse('Failed to delete grade', 500);
  }
}

