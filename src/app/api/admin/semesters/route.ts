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

const semesterSchema = z.object({
  schoolYearId: z.string().min(1, 'School Year ID harus diisi'),
  number: z.number().min(1, 'Nomor semester harus 1 atau 2').max(2),
  semesterLabel: z.string().optional().nullable(),
  semesterLabelArabic: z.string().optional().nullable(),
  startDate: z.string().min(1, 'Tanggal mulai harus diisi'),
  endDate: z.string().min(1, 'Tanggal selesai harus diisi'),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/admin/semesters
 * Get all semesters with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const schoolYearId = searchParams.get('schoolYearId');

    const skip = (page - 1) * limit;

    const where = {
      ...(schoolYearId && { schoolYearId }),
    };

    const [semesters, total] = await Promise.all([
      prisma.semester.findMany({
        where,
        include: {
          schoolYear: { select: { id: true, year: true } },
          _count: {
            select: { classes: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.semester.count({ where }),
    ]);

    return paginatedResponse(semesters, total, page, limit);
  } catch (error) {
    console.error('Get semesters error:', error);
    return errorResponse('Failed to fetch semesters', 500);
  }
}

/**
 * POST /api/admin/semesters
 * Create a new semester
 */
export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await verifyAdmin(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const validatedData = semesterSchema.parse(body);

    // Check if school year exists
    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: validatedData.schoolYearId },
    });

    if (!schoolYear) {
      return errorResponse('Tahun akademik tidak ditemukan', 404);
    }

    // Check if semester with same number already exists for this school year
    const existingSemester = await prisma.semester.findFirst({
      where: {
        schoolYearId: validatedData.schoolYearId,
        number: validatedData.number,
      },
    });

    if (existingSemester) {
      return errorResponse(
        `Semester ${validatedData.number} sudah ada untuk tahun akademik ini`,
        400
      );
    }

    const semester = await prisma.semester.create({
      data: {
        schoolYearId: validatedData.schoolYearId,
        number: validatedData.number,
        semesterLabel: validatedData.semesterLabel || null,
        semesterLabelArabic: validatedData.semesterLabelArabic || null,
        startDate: new Date(validatedData.startDate),
        endDate: new Date(validatedData.endDate),
        isActive: validatedData.isActive ?? true,
      },
      include: {
        schoolYear: true,
        _count: { select: { classes: true } },
      },
    });

    // Log activity
    await logActivity({
      userId: admin.id,
      action: 'CREATE',
      resourceType: 'Semester',
      resourceId: semester.id,
      resourceName: `Semester ${semester.number}`,
      description: `Created semester ${semester.number} for school year ${schoolYear.year}`,
      newValue: {
        number: semester.number,
        semesterLabel: semester.semesterLabel,
        startDate: semester.startDate,
        endDate: semester.endDate,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(semester, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      console.error('Semester validation errors:', fieldErrors);
      return errorResponse('Validation error', 400, fieldErrors);
    }
    console.error('Create semester error:', error);
    
    // Log failed semester creation
    if (admin) {
      await logActivity({
        userId: admin.id,
        action: 'CREATE',
        resourceType: 'Semester',
        description: 'Failed to create semester',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return errorResponse('Failed to create semester', 500);
  }
}
