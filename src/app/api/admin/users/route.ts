import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { hashPassword } from '@/lib/auth/password';

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
  
  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL' || user.role === 'WALI_KELAS')) {
    return user;
  }
  return null;
}

const userSchema = z.object({
  email: z.string().email('Email harus valid'),
  name: z.string().min(1, 'Nama tidak boleh kosong'),
  password: z.string().min(6, 'Password minimal 6 karakter').optional(),
  role: z.enum(['ADMIN', 'TEACHER', 'PRINCIPAL', 'WALI_KELAS']),
  schoolId: z.string().min(1, 'School ID harus diisi'),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/admin/users
 * Get all users with pagination
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
    const search = searchParams.get('search') || '';
    const schoolId = searchParams.get('schoolId');
    const roleParam = searchParams.get('role');

    const skip = (page - 1) * limit;

    // Validate role parameter - only allow valid enum values
    const validRoles: ('ADMIN' | 'TEACHER' | 'PRINCIPAL' | 'WALI_KELAS')[] = ['ADMIN', 'TEACHER', 'PRINCIPAL', 'WALI_KELAS'];
    const role = (roleParam && validRoles.includes(roleParam as any) ? roleParam : undefined) as ('ADMIN' | 'TEACHER' | 'PRINCIPAL' | 'WALI_KELAS' | undefined);

    const where: any = {
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
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return paginatedResponse(users, total, page, limit);
  } catch (error) {
    console.error('Get users error:', error);
    return errorResponse('Failed to fetch users', 500);
  }
}

/**
 * POST /api/admin/users
 * Create a new user
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
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

    const user = await prisma.user.create({
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

    return successResponse(user, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    console.error('Create user error:', error);
    return errorResponse('Failed to create user', 500);
  }
}
