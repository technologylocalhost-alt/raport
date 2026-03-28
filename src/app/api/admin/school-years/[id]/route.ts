import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
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
  
  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL')) {
    return user;
  }
  return null;
}

const schoolYearSchema = z.object({
  year: z.string().regex(/^\d{4}\/\d{4}$/, 'Year format must be YYYY/YYYY').optional(),
  tahunAkademik: z.string().optional().nullable(),
  tahunAkademikArabic: z.string().optional().nullable(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/admin/school-years/[id]
 * Get a school year by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await verifyAdmin(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id },
      include: {
        school: true,
        semesters: {
          select: {
            id: true,
            number: true,
            schoolYearId: true,
            semesterLabel: true,
            semesterLabelArabic: true,
            startDate: true,
            endDate: true,
            isActive: true,
            _count: {
              select: {
                classes: true,
              },
            },
          },
        },
      },
    });

    if (!schoolYear) {
      return errorResponse('School year not found', 404);
    }

    return successResponse(schoolYear);
  } catch (error) {
    console.error('Get school year error:', error);
    return errorResponse('Failed to fetch school year', 500);
  }
}

/**
 * PUT /api/admin/school-years/[id]
 * Update a school year
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await verifyAdmin(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const validatedData = schoolYearSchema.parse(body);

    // Check if school year exists
    const existingSchoolYear = await prisma.schoolYear.findUnique({
      where: { id },
    });

    if (!existingSchoolYear) {
      return errorResponse('School year not found', 404);
    }

    // If setting this as active, deactivate others in the same school
    if (validatedData.isActive) {
      await prisma.schoolYear.updateMany({
        where: {
          schoolId: existingSchoolYear.schoolId,
          id: { not: id },
        },
        data: { isActive: false },
      });
    }

    // Build update data object, only include fields that have values
    const updateData: any = {};
    if (validatedData.year !== undefined) updateData.year = validatedData.year;
    if (validatedData.tahunAkademikArabic !== undefined) {
      updateData.tahunAkademikArabic = validatedData.tahunAkademikArabic || null;
    }
    if (validatedData.startDate !== undefined) updateData.startDate = new Date(validatedData.startDate);
    if (validatedData.endDate !== undefined) updateData.endDate = new Date(validatedData.endDate);
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;

    const schoolYear = await prisma.schoolYear.update({
      where: { id },
      data: updateData,
      include: {
        school: true,
        semesters: true,
      },
    });

    await logActivity({
      userId: admin.id,
      action: 'UPDATE',
      resourceType: 'SchoolYear',
      resourceId: id,
      resourceName: schoolYear.year,
      description: `Updated school year: ${schoolYear.year}`,
      newValue: updateData,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(schoolYear);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    console.error('Update school year error:', error);
    return errorResponse('Failed to update school year', 500);
  }
}

/**
 * DELETE /api/admin/school-years/[id]
 * Delete a school year
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let id = '';
  try {
    const result = await params;
    id = result.id;
    const admin = await verifyAdmin(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    // Check if school year exists
    const existingSchoolYear = await prisma.schoolYear.findUnique({
      where: { id },
    });

    if (!existingSchoolYear) {
      return errorResponse('School year not found', 404);
    }

    // Check if school year has any classes
    const classCount = await prisma.class.count({
      where: { schoolYearId: id },
    });

    if (classCount > 0) {
      return errorResponse(
        'Cannot delete school year with existing classes. Delete all classes first.',
        400
      );
    }

    await prisma.schoolYear.delete({
      where: { id },
    });

    await logActivity({
      userId: admin.id,
      action: 'DELETE',
      resourceType: 'SchoolYear',
      resourceId: id,
      resourceName: existingSchoolYear.year,
      description: `Deleted school year: ${existingSchoolYear.year}`,
      oldValue: {
        year: existingSchoolYear.year,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse({ message: 'School year deleted successfully' });
  } catch (error) {
    console.error('Delete school year error:', error);
    return errorResponse('Failed to delete school year', 500);
  }
}
