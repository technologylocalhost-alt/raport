import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
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

const subjectSchema = z.object({
  levelId: z.string().min(1, 'Level ID is required'),
  code: z.string().min(1, 'Subject code is required'),
  name: z.string().min(1, 'Subject name is required'),
  description: z.string().optional(),
  creditHours: z.number().optional(),
});

/**
 * GET /api/admin/subjects
 * Get all subjects with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const levelId = searchParams.get('levelId');
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    const where = {
      ...(levelId && { levelId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { code: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [subjects, total] = await Promise.all([
      prisma.subject.findMany({
        where,
        include: {
          level: {
            select: { id: true, name: true },
          },
          competencies: {
            select: { id: true, name: true, type: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.subject.count({ where }),
    ]);

    return paginatedResponse(subjects, total, page, limit);
  } catch (error) {
    console.error('Get subjects error:', error);
    return errorResponse('Failed to fetch subjects', 500);
  }
}

/**
 * POST /api/admin/subjects
 * Create a new subject
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = subjectSchema.parse(body);

    // Check if level exists
    const level = await prisma.level.findUnique({
      where: { id: validatedData.levelId },
    });

    if (!level) {
      return errorResponse('Level not found', 404);
    }

    const subject = await prisma.subject.create({
      data: {
        levelId: validatedData.levelId,
        code: validatedData.code,
        name: validatedData.name,
        description: validatedData.description,
        creditHours: validatedData.creditHours,
      },
      include: {
        level: true,
        competencies: true,
      },
    });

    return successResponse(subject, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    console.error('Create subject error:', error);
    return errorResponse('Failed to create subject', 500);
  }
}
