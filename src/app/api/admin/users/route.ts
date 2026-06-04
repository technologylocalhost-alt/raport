import { NextRequest } from 'next/server';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { requireMenuAccess } from '@/lib/auth/verify-access';
import { hashPassword } from '@/lib/auth/password';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { serverError } from '@/lib/server-log';

async function requireUsersAccess(req: NextRequest) {
  return requireMenuAccess(req, '/admin/users', ['ADMIN', 'PRINCIPAL', 'WALI_KELAS']);
}

const VALID_BAGIAN = ['PENGASUHAN', 'MABIKORI', 'PUSDAC', 'LAC', 'EKSKUL'] as const;

const userSchema = z.object({
  email: z.string().email('Email harus valid'),
  name: z.string().min(1, 'Nama tidak boleh kosong'),
  password: z.string().min(6, 'Password minimal 6 karakter').optional(),
  role: z.enum(['ADMIN', 'TEACHER', 'PRINCIPAL', 'WALI_KELAS']),
  schoolId: z.string().min(1, 'School ID harus diisi'),
  isActive: z.boolean().optional(),
  bagian: z.array(z.enum(VALID_BAGIAN)).optional(),
});

/**
 * GET /api/admin/users
 * Get all users with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireUsersAccess(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const schoolId = searchParams.get('schoolId');
    const roleParam = searchParams.get('role');

    const skip = (page - 1) * limit;

    // Validate role parameter - only allow valid enum values
    const validRoles: UserRole[] = ['ADMIN', 'TEACHER', 'PRINCIPAL', 'WALI_KELAS'];
    const role = roleParam && validRoles.includes(roleParam as UserRole)
      ? (roleParam as UserRole)
      : undefined;

    const where = {
      ...(schoolId && { schoolId }),
      ...(role && { role }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          schoolId: true,
          isActive: true,
          createdAt: true,
          school: {
            select: { id: true, name: true },
          },
          bagianList: {
            select: { bagian: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    const usersWithBagian = users.map((u) => ({
      ...u,
      bagian: u.bagianList.map((b) => b.bagian),
      bagianList: undefined,
    }));

    return paginatedResponse(usersWithBagian, total, page, limit);
  } catch (error) {
    serverError('Get users error:', error);
    return errorResponse('Failed to fetch users', 500);
  }
}

/**
 * POST /api/admin/users
 * Create a new user
 */
export async function POST(request: NextRequest) {
  let userData: Record<string, unknown> = {};
  
  try {
    const admin = await requireUsersAccess(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    userData = body; // Save for error logging
    const validatedData = userSchema.parse(body);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return errorResponse('Email sudah terdaftar', 400);
    }

    // Check if school exists
    const school = await prisma.school.findUnique({
      where: { id: validatedData.schoolId },
    });

    if (!school) {
      return errorResponse('Sekolah tidak ditemukan', 404);
    }

    // Hash password
    const hashedPassword = validatedData.password 
      ? await hashPassword(validatedData.password)
      : await hashPassword('password123'); // Default password

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: validatedData.email,
          name: validatedData.name,
          password: hashedPassword,
          role: validatedData.role,
          schoolId: validatedData.schoolId,
          isActive: validatedData.isActive ?? true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          schoolId: true,
          isActive: true,
          createdAt: true,
          school: {
            select: { id: true, name: true },
          },
        },
      });

      // Create bagian records if provided
      if (validatedData.bagian && validatedData.bagian.length > 0) {
        await tx.userBagian.createMany({
          data: validatedData.bagian.map((b) => ({
            userId: created.id,
            bagian: b,
          })),
        });
      }

      return { ...created, bagian: validatedData.bagian || [] };
    });

    // Log activity
    await logActivity({
      userId: admin.id,
      action: 'CREATE',
      resourceType: 'User',
      resourceId: user.id,
      resourceName: `${user.name} (${user.email})`,
      description: `Created user: ${user.name} with role ${user.role}`,
      newValue: {
        email: user.email,
        name: user.name,
        role: user.role,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(user, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    serverError('Create user error:', error);
    
    // Log failed user creation
    const admin = await requireUsersAccess(request);
    if (admin) {
      await logActivity({
        userId: admin.id,
        action: 'CREATE',
        resourceType: 'User',
        description: `Failed to create user`,
        newValue: { email: userData?.email || 'unknown' },
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    
    return errorResponse('Failed to create user', 500);
  }
}
