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

const schoolYearSchema = z.object({
  schoolId: z.string().min(1, 'School ID is required'),
  year: z.string().regex(/^\d{4}\/\d{4}$/, 'Year format must be YYYY/YYYY'),
  tahunAkademik: z.string().optional().nullable(),
  tahunAkademikArabic: z.string().optional().nullable(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/admin/school-years
 * Get all school years with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const schoolId = searchParams.get('schoolId');

    const skip = (page - 1) * limit;

    const where = schoolId ? { schoolId } : {};

    const [schoolYears, total] = await Promise.all([
      prisma.schoolYear.findMany({
        where,
        include: {
          school: {
            select: { id: true, name: true },
          },
          semesters: {
            select: { 
              id: true, 
              number: true, 
              semesterLabel: true,
              semesterLabelArabic: true,
              isActive: true 
            },
          },
        },
        skip,
        take: limit,
        orderBy: { year: 'desc' },
      }),
      prisma.schoolYear.count({ where }),
    ]);

    return paginatedResponse(schoolYears, total, page, limit);
  } catch (error) {
    console.error('Get school years error:', error);
    return errorResponse('Failed to fetch school years', 500);
  }
}

/**
 * POST /api/admin/school-years
 * Create a new school year
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
    const validatedData = schoolYearSchema.parse(body);

    // Check if school exists
    const school = await prisma.school.findUnique({
      where: { id: validatedData.schoolId },
    });

    if (!school) {
      return errorResponse('School not found', 404);
    }

    const schoolYear = await prisma.schoolYear.create({
      data: {
        schoolId: validatedData.schoolId,
        year: validatedData.year,
        tahunAkademik: validatedData.tahunAkademik || null,
        tahunAkademikArabic: validatedData.tahunAkademikArabic || null,
        startDate: new Date(validatedData.startDate),
        endDate: new Date(validatedData.endDate),
        isActive: validatedData.isActive || false,
      },
      include: {
        school: true,
        semesters: true,
      },
    });

    // Log activity
    await logActivity({
      userId: admin.id,
      action: 'CREATE',
      resourceType: 'SchoolYear',
      resourceId: schoolYear.id,
      resourceName: schoolYear.year,
      description: `Created school year: ${schoolYear.year}`,
      newValue: {
        year: schoolYear.year,
        tahunAkademik: schoolYear.tahunAkademik,
        startDate: schoolYear.startDate,
        endDate: schoolYear.endDate,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(schoolYear, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    console.error('Create school year error:', error);
    
    // Log failed school year creation
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
            resourceType: 'SchoolYear',
            description: 'Failed to create school year',
            ipAddress: getClientIp(request),
            userAgent: getUserAgent(request),
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return errorResponse('Failed to create school year', 500);
  }
}
