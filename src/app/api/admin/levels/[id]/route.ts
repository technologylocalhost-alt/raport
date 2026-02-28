import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth/jwt';

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

const levelSchema = z.object({
  name: z.string().min(1, 'Level name is required').optional(),
  code: z.string().min(1, 'Level code is required').optional(),
  order: z.number().int().min(0).optional(),
  levelCount: z.number().int().min(0).optional(),
  description: z.string().optional(),
});

/**
 * GET /api/admin/levels/[id]
 * Get a level by ID
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

    const level = await prisma.level.findUnique({
      where: { id },
      include: {
        school: true,
        subjects: {
          include: {
            competencies: true,
          },
        },
        classes: {
          include: {
            students: true,
          },
        },
        reportConfigs: true,
      },
    });

    if (!level) {
      return errorResponse('Level not found', 404);
    }

    return successResponse(level);
  } catch (error) {
    console.error('Get level error:', error);
    return errorResponse('Failed to fetch level', 500);
  }
}

/**
 * PUT /api/admin/levels/[id]
 * Update a level
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
    const validatedData = levelSchema.parse(body);

    // Check if level exists
    const existingLevel = await prisma.level.findUnique({
      where: { id },
    });

    if (!existingLevel) {
      return errorResponse('Level not found', 404);
    }

    const level = await prisma.level.update({
      where: { id },
      data: validatedData,
      include: {
        school: true,
        subjects: true,
        classes: true,
      },
    });

    return successResponse(level);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    console.error('Update level error:', error);
    return errorResponse('Failed to update level', 500);
  }
}

/**
 * DELETE /api/admin/levels/[id]
 * Delete a level
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

    // Check if level exists
    const existingLevel = await prisma.level.findUnique({
      where: { id },
    });

    if (!existingLevel) {
      return errorResponse('Level not found', 404);
    }

    // Check if level has any subjects
    const subjectCount = await prisma.subject.count({
      where: { levelId: id },
    });

    if (subjectCount > 0) {
      return errorResponse(
        'Cannot delete level with existing subjects. Delete all subjects first.',
        400
      );
    }

    // Check if level has any classes
    const classCount = await prisma.class.count({
      where: { levelId: id },
    });

    if (classCount > 0) {
      return errorResponse(
        'Cannot delete level with existing classes. Delete all classes first.',
        400
      );
    }

    await prisma.level.delete({
      where: { id },
    });

    return successResponse({ message: 'Level deleted successfully' });
  } catch (error) {
    console.error('Delete level error:', error);
    return errorResponse('Failed to delete level', 500);
  }
}
