import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { extractAccessToken } from '@/lib/auth/token-extractor';

async function verifyAdmin(req: NextRequest) {
  const token = extractAccessToken(req);
  if (!token) {
    return null;
  }

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
  schoolId: z.string().min(1, 'School ID is required'),
  name: z.string().min(1, 'Level name is required'),
  code: z.string().min(1, 'Level code is required'),
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
        orderBy: { createdAt: 'asc' },
      }),
      prisma.level.count({ where }),
    ]);

    return paginatedResponse(levels, total, page, limit);
  } catch (error) {
    console.error('Get levels error:', error);
    return errorResponse('Failed to fetch levels', 500);
  }
}

/**
 * POST /api/admin/levels
 * Create a new level
 */
export async function POST(request: NextRequest) {
  try {
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

    return successResponse(level, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    console.error('Create level error:', error);
    return errorResponse('Failed to create level', 500);
  }
}
