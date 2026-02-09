import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth/jwt';

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
    console.error('Get school error:', error);
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
    const admin = await verifyAdmin(request);
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

    return successResponse(school);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    console.error('Update school error:', error);
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
    const admin = await verifyAdmin(request);
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

    return successResponse({ message: 'School deleted successfully' });
  } catch (error) {
    console.error('Delete school error:', error);
    return errorResponse('Failed to delete school', 500);
  }
}
