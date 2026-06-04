import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { AuthenticatedUser } from '@/lib/auth/access';
import { ensureClassOwnedByWaliKelasOrAllowed, requireClassSubjectAccess } from '@/lib/auth/class-access';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { serverError } from '@/lib/server-log';


/**
 * DELETE /api/admin/classes/[id]/teachers/[teacherId]
 * Remove a teacher from a class
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; teacherId: string }> }
) {
  let user: AuthenticatedUser | null = null;
  let id = '';
  let teacherId = '';
  try {
    user = await requireClassSubjectAccess(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const result = await params;
    id = result.id;
    teacherId = result.teacherId;

    const access = await ensureClassOwnedByWaliKelasOrAllowed(user, id);

    if (!access.ok) {
      return errorResponse(access.reason === 'NOT_FOUND' ? 'Class not found' : 'Unauthorized', access.reason === 'NOT_FOUND' ? 404 : 403);
    }

    // Delete class teacher by id
    const deleted = await prisma.classTeacher.delete({
      where: { id: teacherId },
      include: {
        teacher: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    await logActivity({
      userId: user.id,
      action: 'DELETE',
      resourceType: 'ClassTeacher',
      resourceId: teacherId,
      resourceName: `${deleted.teacher.name} - ${deleted.subject.name}`,
      description: `Removed ${deleted.teacher.name} from teaching ${deleted.subject.name}`,
      oldValue: { teacherId: deleted.teacher.id, subjectId: deleted.subject.id },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(deleted, 'Teacher removed from class');
  } catch (error: unknown) {
    serverError('Delete teacher from class error:', error);
    if (user) {
      await logActivity({
        userId: user.id,
        action: 'DELETE',
        resourceType: 'ClassTeacher',
        resourceId: teacherId,
        description: `Failed to remove teacher from class`,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
      });
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      return errorResponse('Teacher assignment not found', 404);
    }
    return errorResponse('Failed to remove teacher from class', 500);
  }
}
