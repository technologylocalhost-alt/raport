import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { ensureClassOwnedByWaliKelasOrAllowed, requireClassSubjectAccess } from '@/lib/auth/class-access';
import { AuthenticatedUser } from '@/lib/auth/access';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { serverError } from '@/lib/server-log';


/**
 * GET /api/admin/classes/[id]/teachers
 * Get all teachers assigned to a specific class
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireClassSubjectAccess(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    const access = await ensureClassOwnedByWaliKelasOrAllowed(user, id);

    if (!access.ok) {
      return errorResponse(access.reason === 'NOT_FOUND' ? 'Class not found' : 'Unauthorized', access.reason === 'NOT_FOUND' ? 404 : 403);
    }

    const teachers = await prisma.classTeacher.findMany({
      where: { classId: id },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        subject: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: { teacher: { name: 'asc' } },
    });

    return successResponse(teachers, 'Teachers retrieved successfully');
  } catch (error: unknown) {
    serverError('Get class teachers error:', error);
    return errorResponse('Failed to retrieve teachers', 500);
  }
}

/**
 * POST /api/admin/classes/[id]/teachers
 * Add a teacher to a class for a specific subject
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user: AuthenticatedUser | null = null;
  try {
    user = await requireClassSubjectAccess(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    const access = await ensureClassOwnedByWaliKelasOrAllowed(user, id);

    if (!access.ok) {
      return errorResponse(access.reason === 'NOT_FOUND' ? 'Class not found' : 'Unauthorized', access.reason === 'NOT_FOUND' ? 404 : 403);
    }

    const body = await request.json();
    const { teacherId, subjectId } = body;

    if (!teacherId || !subjectId) {
      return errorResponse('Teacher ID and Subject ID are required', 400);
    }

    // Verify teacher exists
    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      return errorResponse('Teacher not found', 404);
    }

    // Verify subject exists
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      return errorResponse('Subject not found', 404);
    }

    // Verify subject is assigned to this class
    const classSubject = await prisma.classSubject.findUnique({
      where: {
        classId_subjectId: {
          classId: id,
          subjectId,
        },
      },
    });

    if (!classSubject) {
      return errorResponse('Subject not assigned to this class', 400);
    }

    // Check if teacher already assigned to teach this subject in this class
    const existing = await prisma.classTeacher.findUnique({
      where: {
        classId_teacherId_subjectId: {
          classId: id,
          teacherId,
          subjectId,
        },
      },
    });

    if (existing) {
      return errorResponse('Teacher already assigned to teach this subject in this class', 400);
    }

    // Create class teacher
    const classTeacher = await prisma.classTeacher.create({
      data: {
        classId: id,
        teacherId,
        subjectId,
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        subject: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    await logActivity({
      userId: user.id,
      action: 'CREATE',
      resourceType: 'ClassTeacher',
      resourceId: classTeacher.id,
      resourceName: `${classTeacher.teacher.name} - ${classTeacher.subject.name}`,
      description: `Assigned ${classTeacher.teacher.name} to teach ${classTeacher.subject.name}`,
      newValue: { teacherId, subjectId },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(classTeacher, 'Teacher added to class', 201);
  } catch (error: unknown) {
    serverError('Add teacher to class error:', error);
    if (user) {
      await logActivity({
        userId: user.id,
        action: 'CREATE',
        resourceType: 'ClassTeacher',
        resourceId: '',
        description: `Failed to add teacher to class`,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
      });
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return errorResponse('Teacher already assigned to this subject in this class', 400);
    }
    return errorResponse('Failed to add teacher to class', 500);
  }
}
