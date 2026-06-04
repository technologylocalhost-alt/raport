import { NextRequest } from 'next/server';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { requireAdminOrPrincipal } from '@/lib/auth/admin-access';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { serverError } from '@/lib/server-log';

async function requireLevelAccess(req: NextRequest) {
  return requireAdminOrPrincipal(req);
}

const levelSchema = z.object({
  schoolId: z.string().min(1, 'School ID is required'),
  name: z.string().min(1, 'Level name is required'),
  code: z.string().min(1, 'Level code is required'),
  order: z.number().int().min(0).optional().default(0),
  levelCount: z.number().int().min(0).optional().default(0),
  description: z.string().optional().default(''),
});

/**
 * GET /api/admin/levels
 * Get all levels with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const schoolId = searchParams.get('schoolId');

    const skip = (page - 1) * limit;

    const where = schoolId ? { schoolId } : {};

    const [levels, total] = await Promise.all([
      prisma.level.findMany({
        where,
        include: {
          school: {
            select: { id: true, name: true },
          },
          subjects: {
            select: { id: true, name: true, code: true },
          },
          classes: {
            select: { id: true, name: true },
          },
        },
        skip,
        take: limit,
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.level.count({ where }),
    ]);

    return paginatedResponse(levels, total, page, limit);
  } catch (error) {
    serverError('Get levels error:', error);
    return errorResponse('Failed to fetch levels', 500);
  }
}

/**
 * POST /api/admin/levels
 * Create a new level
 */
export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await requireLevelAccess(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const validatedData = levelSchema.parse(body);

    // Check if school exists
    const school = await prisma.school.findUnique({
      where: { id: validatedData.schoolId },
    });

    if (!school) {
      return errorResponse('School not found', 404);
    }

    const level = await prisma.level.create({
      data: validatedData,
      include: {
        school: true,
        subjects: true,
        classes: true,
      },
    });

    // Log activity
    await logActivity({
      userId: admin.id,
      action: 'CREATE',
      resourceType: 'Level',
      resourceId: level.id,
      resourceName: level.name,
      description: `Created level: ${level.name} (${level.code})`,
      newValue: {
        name: level.name,
        code: level.code,
        order: level.order,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(level, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    serverError('Create level error:', error);
    
    // Log failed level creation
    if (admin) {
      await logActivity({
        userId: admin.id,
        action: 'CREATE',
        resourceType: 'Level',
        description: 'Failed to create level',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return errorResponse('Failed to create level', 500);
  }
}
