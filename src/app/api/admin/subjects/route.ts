import { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/access';
import { requireMenuAccess } from '@/lib/auth/verify-access';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { serverError } from '@/lib/server-log';

async function requireSubjectManagement(req: NextRequest) {
  return requireMenuAccess(req, '/admin/subjects', ['ADMIN', 'PRINCIPAL']);
}

async function requireSubjectListAccess(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;

  if (user.role === 'ADMIN' || user.role === 'PRINCIPAL') {
    return requireMenuAccess(req, '/admin/subjects', ['ADMIN', 'PRINCIPAL']);
  }

  if (user.role === 'WALI_KELAS') {
    return requireMenuAccess(req, '/wali-kelas/management', ['WALI_KELAS']);
  }

  if (user.role === 'TEACHER') {
    return requireMenuAccess(req, '/teacher/subjects', ['TEACHER']);
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
    const user = await requireSubjectListAccess(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const levelId = searchParams.get('levelId');
    const semesterId = searchParams.get('semesterId');
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    const where: Prisma.SubjectWhereInput = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
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
    serverError('Get subjects error:', error);
    return errorResponse('Failed to fetch subjects', 500);
  }
}

/**
 * POST /api/admin/subjects
 * Create a new subject
 */
export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await requireSubjectManagement(request);
    if (!admin) {
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
    serverError('Create subject error:', error);
    
    // Log failed subject creation
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

    return errorResponse('Failed to create subject', 500);
  }
}
