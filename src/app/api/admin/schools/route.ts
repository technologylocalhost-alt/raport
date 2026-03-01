import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';

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
 * GET /api/admin/schools
 * Get all schools with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { npsn: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [schools, total] = await Promise.all([
      prisma.school.findMany({
        where,
        include: {
          levels: {
            select: { id: true, name: true },
          },
          users: {
            select: { id: true, name: true, role: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.school.count({ where }),
    ]);

    return paginatedResponse(schools, total, page, limit);
  } catch (error) {
    console.error('Get schools error:', error);
    return errorResponse('Failed to fetch schools', 500);
  }
}

/**
 * POST /api/admin/schools
 * Create a new school
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const validatedData = schoolSchema.parse(body);

    const school = await prisma.school.create({
      data: validatedData,
      include: {
        levels: true,
        users: true,
      },
    });

    // Log activity
    await logActivity({
      userId: admin.id,
      action: 'CREATE',
      resourceType: 'School',
      resourceId: school.id,
      resourceName: school.name,
      description: `Created school: ${school.name}`,
      newValue: {
        name: school.name,
        address: validatedData.address,
        phone: validatedData.phone,
        email: validatedData.email,
        npsn: validatedData.npsn,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(school, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    console.error('Create school error:', error);
    
    // Log failed school creation
    const admin = await verifyAdmin(request);
    if (admin) {
      await logActivity({
        userId: admin.id,
        action: 'CREATE',
        resourceType: 'School',
        description: 'Failed to create school',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return errorResponse('Failed to create school', 500);
  }
}
