import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
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

const subjectSchema = z.object({
  levelId: z.string().min(1, 'Level ID is required'),
  code: z.string().min(1, 'Subject code is required'),
  name: z.string().min(1, 'Subject name is required'),
  nameArabic: z.string().optional(),
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
    const semesterId = searchParams.get('semesterId');
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    let where: any = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { code: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    // If semesterId is provided, get levels that have classes in that semester
    if (semesterId) {
      const levelsInSemester = await prisma.class.findMany({
        where: { semesterId },
        distinct: ['levelId'],
        select: { levelId: true },
      });
      
      const levelIds = levelsInSemester.map(c => c.levelId);
      where.levelId = { in: levelIds };
    } else if (levelId) {
      where.levelId = levelId;
    }

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
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('Unauthorized', 401);
    }

    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);
    
    if (!payload) {
      return errorResponse('Unauthorized', 401);
    }

    const admin = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    
    if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'PRINCIPAL')) {
      return errorResponse('Unauthorized', 401);
    }

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
        nameArabic: validatedData.nameArabic,
        description: validatedData.description,
        creditHours: validatedData.creditHours,
      },
      include: {
        level: true,
        competencies: true,
      },
    });

    // Log activity
    await logActivity({
      userId: admin.id,
      action: 'CREATE',
      resourceType: 'Subject',
      resourceId: subject.id,
      resourceName: subject.name,
      description: `Created subject: ${subject.name} (${subject.code})`,
      newValue: {
        name: subject.name,
        code: subject.code,
        levelId: subject.levelId,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(subject, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    console.error('Create subject error:', error);
    
    // Log failed subject creation
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = verifyAccessToken(token);
      if (payload) {
        const admin = await prisma.user.findUnique({
          where: { id: payload.userId },
        });
        if (admin) {
          await logActivity({
            userId: admin.id,
            action: 'CREATE',
            resourceType: 'Subject',
            description: 'Failed to create subject',
            ipAddress: getClientIp(request),
            userAgent: getUserAgent(request),
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return errorResponse('Failed to create subject', 500);
  }
}
