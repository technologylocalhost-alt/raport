import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/access';
import { requireMenuAccess } from '@/lib/auth/verify-access';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { serverError } from '@/lib/server-log';

async function requireSubjectManagement(req: NextRequest) {
  return requireMenuAccess(req, '/admin/subjects', ['ADMIN', 'PRINCIPAL']);
}

async function requireSubjectReadAccess(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;

  if (user.role === 'ADMIN' || user.role === 'PRINCIPAL') {
    return requireMenuAccess(req, '/admin/subjects', ['ADMIN', 'PRINCIPAL']);
  }

  if (user.role === 'TEACHER') {
    return requireMenuAccess(req, '/teacher/subjects', ['TEACHER']);
  }

  if (user.role === 'WALI_KELAS') {
    return requireMenuAccess(req, '/wali-kelas/management', ['WALI_KELAS']);
  }

  return null;
}

const subjectSchema = z.object({
  code: z.string().min(1, 'Subject code is required').optional(),
  name: z.string().min(1, 'Subject name is required').optional(),
  nameArabic: z.string().optional(),
  description: z.string().optional(),
  creditHours: z.number().optional(),
});

/**
 * GET /api/admin/subjects/[id]
 * Get a subject by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireSubjectReadAccess(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        level: true,
        competencies: true,
      },
    });

    if (!subject) {
      return errorResponse('Subject not found', 404);
    }

    return successResponse(subject);
  } catch (error) {
    serverError('Get subject error:', error);
    return errorResponse('Failed to fetch subject', 500);
  }
}

/**
 * PUT /api/admin/subjects/[id]
 * Update a subject
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireSubjectManagement(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const validatedData = subjectSchema.parse(body);

    // Check if subject exists
    const existingSubject = await prisma.subject.findUnique({
      where: { id },
    });

    if (!existingSubject) {
      return errorResponse('Subject not found', 404);
    }

    const subject = await prisma.subject.update({
      where: { id },
      data: validatedData,
      include: {
        level: true,
        competencies: true,
      },
    });

    await logActivity({
      userId: admin.id,
      action: 'UPDATE',
      resourceType: 'Subject',
      resourceId: id,
      resourceName: subject.name,
      description: `Updated subject: ${subject.name}`,
      newValue: validatedData,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(subject);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    serverError('Update subject error:', error);
    return errorResponse('Failed to update subject', 500);
  }
}

/**
 * DELETE /api/admin/subjects/[id]
 * Delete a subject
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireSubjectManagement(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    // Check if subject exists
    const existingSubject = await prisma.subject.findUnique({
      where: { id },
    });

    if (!existingSubject) {
      return errorResponse('Subject not found', 404);
    }

    // Check if subject has any competencies
    const competencyCount = await prisma.competency.count({
      where: { subjectId: id },
    });

    if (competencyCount > 0) {
      return errorResponse(
        'Cannot delete subject with existing competencies. Delete all competencies first.',
        400
      );
    }

    await prisma.subject.delete({
      where: { id },
    });

    await logActivity({
      userId: admin.id,
      action: 'DELETE',
      resourceType: 'Subject',
      resourceId: id,
      resourceName: existingSubject.name,
      description: `Deleted subject: ${existingSubject.name}`,
      oldValue: {
        name: existingSubject.name,
        code: existingSubject.code,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse({ message: 'Subject deleted successfully' });
  } catch (error) {
    serverError('Delete subject error:', error);
    return errorResponse('Failed to delete subject', 500);
  }
}
