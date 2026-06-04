import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { requireAdminOrPrincipal } from '@/lib/auth/admin-access';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { serverError } from '@/lib/server-log';

const schoolSchema = z.object({
  name: z.string().min(1, 'School name is required'),
  address: z.string().min(1, 'Address is required'),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  npsn: z.string().optional(),
});

/**
 * Verify admin authorization
 */
async function requireSchoolAccess(req: NextRequest) {
  return requireAdminOrPrincipal(req);
}

/**
 * GET /api/admin/schools/[id]
 * Get a school by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const school = await prisma.school.findUnique({
      where: { id },
      include: {
        levels: {
          include: {
            subjects: true,
          },
        },
        schoolYears: {
          include: {
            semesters: true,
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!school) {
      return errorResponse('School not found', 404);
    }

    return successResponse(school);
  } catch (error) {
    serverError('Get school error:', error);
    return errorResponse('Failed to fetch school', 500);
  }
}

/**
 * PUT /api/admin/schools/[id]
 * Update a school
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireSchoolAccess(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const validatedData = schoolSchema.parse(body);

    // Check if school exists
    const existingSchool = await prisma.school.findUnique({
      where: { id },
    });

    if (!existingSchool) {
      return errorResponse('School not found', 404);
    }

    const school = await prisma.school.update({
      where: { id },
      data: validatedData,
      include: {
        levels: true,
        users: true,
      },
    });

    // Log activity
    await logActivity({
      userId: admin.id,
      action: 'UPDATE',
      resourceType: 'School',
      resourceId: id,
      resourceName: school.name,
      description: `Updated school: ${school.name}`,
      newValue: {
        name: school.name,
        address: validatedData.address,
        phone: validatedData.phone,
        email: validatedData.email,
        npsn: validatedData.npsn,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(school);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    serverError('Update school error:', error);
    return errorResponse('Failed to update school', 500);
  }
}

/**
 * DELETE /api/admin/schools/[id]
 * Delete a school
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireSchoolAccess(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    // Check if school exists
    const existingSchool = await prisma.school.findUnique({
      where: { id },
    });

    if (!existingSchool) {
      return errorResponse('School not found', 404);
    }

    // Check if school has any users
    const userCount = await prisma.user.count({
      where: { schoolId: id },
    });

    if (userCount > 0) {
      return errorResponse(
        'Cannot delete school with existing users. Delete all users first.',
        400
      );
    }

    await prisma.school.delete({
      where: { id },
    });

    // Log activity
    await logActivity({
      userId: admin.id,
      action: 'DELETE',
      resourceType: 'School',
      resourceId: id,
      resourceName: existingSchool.name,
      description: `Deleted school: ${existingSchool.name}`,
      oldValue: {
        name: existingSchool.name,
        address: existingSchool.address,
        phone: existingSchool.phone,
        email: existingSchool.email,
        npsn: existingSchool.npsn,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse({ message: 'School deleted successfully' });
  } catch (error) {
    serverError('Delete school error:', error);
    return errorResponse('Failed to delete school', 500);
  }
}
