import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { ensureClassOwnedByWaliKelasOrAllowed, requireClassSubjectAccess } from '@/lib/auth/class-access';
import { AuthenticatedUser } from '@/lib/auth/access';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { serverError } from '@/lib/server-log';


/**
 * GET /api/admin/classes/[id]/subjects
 * Get all subjects assigned to a specific class
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

    const subjects = await prisma.classSubject.findMany({
      where: { classId: id },
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
      orderBy: { subject: { code: 'asc' } },
    });

    return successResponse(subjects, 'Subjects retrieved successfully');
  } catch (error: unknown) {
    serverError('Get class subjects error:', error);
    return errorResponse('Failed to retrieve subjects', 500);
  }
}

/**
 * POST /api/admin/classes/[id]/subjects
 * Add a subject to a class
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
    const { subjectId } = body;

    if (!subjectId) {
      return errorResponse('Subject ID is required', 400);
    }

    // Verify subject exists
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      return errorResponse('Subject not found', 404);
    }

    // Check if subject already assigned to this class
    const existing = await prisma.classSubject.findUnique({
      where: {
        classId_subjectId: {
          classId: id,
          subjectId,
        },
      },
    });

    if (existing) {
      return errorResponse('Subject already assigned to this class', 400);
    }

    // Create class subject
    const classSubject = await prisma.classSubject.create({
      data: {
        classId: id,
        subjectId,
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

    await logActivity({
      userId: user.id,
      action: 'CREATE',
      resourceType: 'ClassSubject',
      resourceId: classSubject.subject.id,
      resourceName: classSubject.subject.name,
      description: `Added subject ${classSubject.subject.name} to class`,
      newValue: { subjectId },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(classSubject, 'Subject added to class', 201);
  } catch (error: unknown) {
    serverError('Add subject to class error:', error);
    if (user) {
      await logActivity({
        userId: user.id,
        action: 'CREATE',
        resourceType: 'ClassSubject',
        resourceId: '',
        description: `Failed to add subject to class`,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
      });
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return errorResponse('Subject already assigned to this class', 400);
    }
    return errorResponse('Failed to add subject to class', 500);
  }
}
