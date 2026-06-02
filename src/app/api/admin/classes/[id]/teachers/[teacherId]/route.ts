import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';

async function verifyAdmin(req: NextRequest) {
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
  
  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL' || user.role === 'WALI_KELAS')) {
    return user;
  }
  return null;
}

/**
 * DELETE /api/admin/classes/[id]/teachers/[teacherId]
 * Remove a teacher from a class
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; teacherId: string }> }
) {
  let user: any;
  let id = '';
  let teacherId = '';
  try {
    user = await verifyAdmin(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const result = await params;
    id = result.id;
    teacherId = result.teacherId;

    // Verify the class exists
    const classData = await prisma.class.findUnique({
      where: { id },
      select: { id: true, waliKelasId: true },
    });

    if (!classData) {
      return errorResponse('Class not found', 404);
    }

    // If user is WALI_KELAS, verify they own this class
    if (user.role === 'WALI_KELAS' && classData.waliKelasId !== user.id) {
      return errorResponse('Unauthorized', 403);
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
  } catch (error: any) {
    console.error('Delete teacher from class error:', error);
    if (user) {
      await logActivity({
        userId: user.id,
        action: 'DELETE',
        resourceType: 'ClassTeacher',
        resourceId: teacherId,
        description: `Failed to remove teacher from class`,
        errorMessage: error?.message || 'Unknown error',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
      });
    }
    if (error.code === 'P2025') {
      return errorResponse('Teacher assignment not found', 404);
    }
    return errorResponse('Failed to remove teacher from class', 500);
  }
}
