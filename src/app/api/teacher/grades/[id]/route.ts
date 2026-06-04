import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { requireTeacherWaliAdminPrincipal } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

const gradeUpdateSchema = z.object({
  score: z
    .union([z.string(), z.number()])
    .transform((val) => parseFloat(String(val)))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 10, {
      message: 'Score must be a number between 1 and 10',
    })
    .optional(),
  assessmentType: z.enum(['UTS_1', 'UAS_1', 'UTS_2', 'UAS_2', 'FINAL_EXAM_1', 'FINAL_EXAM_2']).optional(),
  notes: z.string().optional(),
});

async function requireGradeAccess(req: NextRequest) {
  return requireTeacherWaliAdminPrincipal(req);
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
    const teacher = await requireGradeAccess(request);

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
        subject: true,
      },
    });

    if (!grade) {
      return errorResponse('Grade not found', 404);
    }

    // Check authorization - teacher owns the grade or wali-kelas is assigned to the student's class or admin/principal can do anything
    let authorized = false;
    if (teacher.role === 'ADMIN' || teacher.role === 'PRINCIPAL') {
      authorized = true;
    } else if (grade.teacherId === teacher.id) {
      authorized = true;
    } else if (teacher.role === 'WALI_KELAS') {
      const student = await prisma.student.findUnique({
        where: { id: grade.studentId },
        include: { class: true },
      });
      if (student?.class?.waliKelasId === teacher.id) {
        authorized = true;
      }
    }

    if (!authorized) {
      return errorResponse('Unauthorized to view this grade', 403);
    }

    return successResponse({
      id: grade.id,
      studentId: grade.studentId,
      studentName: grade.student.name,
      competencyId: grade.competencyId || '',
      competencyName: grade.competency?.name || '',
      subjectName: grade.competency?.subject?.name || grade.subject?.name || '',
      score: grade.score,
      assessmentType: grade.assessmentType,
      notes: grade.notes || '',
      date: grade.createdAt?.toISOString().split('T')[0],
    });
  } catch (error) {
    serverError('Get grade error:', error);
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
    const teacher = await requireGradeAccess(request);

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

    // Check authorization - teacher owns the grade or wali-kelas is assigned to the student's class or admin/principal can do anything
    let authorized = false;
    if (teacher.role === 'ADMIN' || teacher.role === 'PRINCIPAL') {
      authorized = true;
    } else if (grade.teacherId === teacher.id) {
      authorized = true;
    } else if (teacher.role === 'WALI_KELAS') {
      const student = await prisma.student.findUnique({
        where: { id: grade.studentId },
        include: { class: true },
      });
      if (student?.class?.waliKelasId === teacher.id) {
        authorized = true;
      }
    }

    if (!authorized) {
      return errorResponse('Unauthorized to update this grade', 403);
    }

    // Check if grade has been approved - if so, prevent update
    const approvedGrade = await prisma.nilaiApprove.findFirst({
      where: {
        studentId: grade.studentId,
        competencyId: grade.competencyId,
        assessmentType: grade.assessmentType,
        ...(grade.subjectId ? { subjectId: grade.subjectId } : {}),
      },
    });

    if (approvedGrade) {
      return errorResponse(
        'Nilai ini sudah disetujui dan tidak dapat diubah. Hubungi Wali Kelas untuk perubahan lebih lanjut.',
        409
      );
    }

    // Build update data, converting score to float if provided
    const updateData: Record<string, unknown> = {};
    if (validatedData.score !== undefined) {
      updateData.score = String(validatedData.score);
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
        subject: true,
      },
    });

    // Log activity
    await logActivity({
      userId: teacher.id,
      action: 'UPDATE',
      resourceType: 'Grade',
      resourceId: id,
      resourceName: `Grade for ${updatedGrade.student.name} - ${updatedGrade.competency?.name || 'No Competency'}`,
      description: `Updated grade for ${updatedGrade.student.name}: ${updatedGrade.score}`,
      newValue: {
        score: updatedGrade.score,
        assessmentType: updatedGrade.assessmentType,
        notes: updatedGrade.notes,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse({
      id: updatedGrade.id,
      studentId: updatedGrade.studentId,
      studentName: updatedGrade.student.name,
      competencyId: updatedGrade.competencyId || '',
      competencyName: updatedGrade.competency?.name || '',
      subjectName: updatedGrade.competency?.subject?.name || updatedGrade.subject?.name || '',
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
    serverError('Update grade error:', error);
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
    const teacher = await requireGradeAccess(request);

    if (!teacher) {
      return errorResponse('Unauthorized', 401);
    }

    // Verify that the teacher owns this grade
    const grade = await prisma.grade.findUnique({
      where: { id },
      include: {
        student: true,
        competency: true,
      },
    });

    if (!grade) {
      return errorResponse('Grade not found', 404);
    }

    // Check authorization - teacher owns the grade or wali-kelas is assigned to the student's class or admin/principal can do anything
    let authorized = false;
    if (teacher.role === 'ADMIN' || teacher.role === 'PRINCIPAL') {
      authorized = true;
    } else if (grade.teacherId === teacher.id) {
      authorized = true;
    } else if (teacher.role === 'WALI_KELAS') {
      const student = await prisma.student.findUnique({
        where: { id: grade.studentId },
        include: { class: true },
      });
      if (student?.class?.waliKelasId === teacher.id) {
        authorized = true;
      }
    }

    if (!authorized) {
      return errorResponse('Unauthorized to delete this grade', 403);
    }

    await prisma.grade.delete({
      where: { id },
    });

    // Log activity
    await logActivity({
      userId: teacher.id,
      action: 'DELETE',
      resourceType: 'Grade',
      resourceId: id,
      resourceName: `Grade for ${grade.student.name} - ${grade.competency?.name || 'No Competency'}`,
      description: `Deleted grade for ${grade.student.name}: ${grade.score}`,
      oldValue: {
        studentId: grade.studentId,
        competencyId: grade.competencyId,
        score: grade.score,
        assessmentType: grade.assessmentType,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse({ message: 'Grade deleted successfully' });
  } catch (error) {
    serverError('Delete grade error:', error);
    return errorResponse('Failed to delete grade', 500);
  }
}

