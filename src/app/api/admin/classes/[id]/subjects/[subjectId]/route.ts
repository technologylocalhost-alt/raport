import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { AuthenticatedUser } from '@/lib/auth/access';
import {
  ensureClassOwnedByWaliKelasOrAllowed,
  requireClassSubjectAccess,
  requireEditableClassByPeriod,
} from '@/lib/auth/class-access';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { serverError } from '@/lib/server-log';


/**
 * GET /api/admin/classes/[id]/subjects/[subjectId]
 * Get a specific class subject relationship
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subjectId: string }> }
) {
  try {
    const user = await requireClassSubjectAccess(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id, subjectId } = await params;
    const access = await ensureClassOwnedByWaliKelasOrAllowed(user, id);

    if (!access.ok) {
      return errorResponse(access.reason === 'NOT_FOUND' ? 'Class not found' : 'Unauthorized', access.reason === 'NOT_FOUND' ? 404 : 403);
    }

    const classSubject = await prisma.classSubject.findUnique({
      where: {
        classId_subjectId: {
          classId: id,
          subjectId,
        },
      },
      include: {
        subject: {
          select: {
            id: true,
            code: true,
            name: true,
            nameArabic: true,
            description: true,
            creditHours: true,
          },
        },
      },
    });

    if (!classSubject) {
      return errorResponse('Subject not found in this class', 404);
    }

    return successResponse(classSubject, 'Subject retrieved successfully');
  } catch (error: unknown) {
    serverError('Get class subject error:', error);
    return errorResponse('Failed to retrieve subject', 500);
  }
}

/**
 * DELETE /api/admin/classes/[id]/subjects/[subjectId]
 * Remove a subject from a class
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subjectId: string }> }
) {
  let user: AuthenticatedUser | null = null;
  let id = '';
  let subjectId = '';
  try {
    user = await requireClassSubjectAccess(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const result = await params;
    id = result.id;
    subjectId = result.subjectId;

    const access = await ensureClassOwnedByWaliKelasOrAllowed(user, id);

    if (!access.ok) {
      return errorResponse(access.reason === 'NOT_FOUND' ? 'Class not found' : 'Unauthorized', access.reason === 'NOT_FOUND' ? 404 : 403);
    }

    const writableClass = await requireEditableClassByPeriod(id);
    if (!writableClass.ok) {
      return errorResponse('Kelas semester lampau hanya dapat dibaca', 403);
    }

    // Check if the ClassSubject exists first
    const existingClassSubject = await prisma.classSubject.findUnique({
      where: {
        classId_subjectId: {
          classId: id,
          subjectId,
        },
      },
    });

    if (!existingClassSubject) {
      return errorResponse('Subject not found in this class', 404);
    }

    // Delete class subject
    const deleted = await prisma.classSubject.delete({
      where: {
        classId_subjectId: {
          classId: id,
          subjectId,
        },
      },
      include: {
        subject: { select: { id: true, name: true } },
      },
    });


    await logActivity({
      userId: user.id,
      action: 'DELETE',
      resourceType: 'ClassSubject',
      resourceId: subjectId,
      resourceName: deleted.subject.name,
      description: `Removed subject ${deleted.subject.name} from class`,
      oldValue: { classId: id, subjectId },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(deleted, 'Subject removed from class');
  } catch (error: unknown) {
    serverError('Delete subject from class error:', error);
    if (user) {
      await logActivity({
        userId: user.id,
        action: 'DELETE',
        resourceType: 'ClassSubject',
        resourceId: subjectId,
        description: `Failed to remove subject from class`,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
      });
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      return errorResponse('Subject not found in this class', 404);
    }
    return errorResponse('Failed to remove subject from class', 500);
  }
}
