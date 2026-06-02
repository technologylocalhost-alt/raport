import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { hashPassword } from '@/lib/auth/password';
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

const userUpdateSchema = z.object({
  email: z.string().email('Email harus valid').optional(),
  name: z.string().min(1, 'Nama tidak boleh kosong').optional(),
  password: z.string().min(6, 'Password minimal 6 karakter').optional(),
  role: z.enum(['ADMIN', 'TEACHER', 'PRINCIPAL', 'WALI_KELAS']).optional(),
  schoolId: z.string().min(1, 'School ID harus diisi').optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/admin/users/[id]
 * Get a user by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await verifyAdmin(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id },
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

    if (!user) {
      return errorResponse('User tidak ditemukan', 404);
    }

    return successResponse(user);
  } catch (error) {
    console.error('Get user error:', error);
    return errorResponse('Failed to fetch user', 500);
  }
}

/**
 * PUT /api/admin/users/[id]
 * Update a user
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin: any;
  let id = '';
  try {
    const result = await params;
    id = result.id;
    admin = await verifyAdmin(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const validatedData = userUpdateSchema.parse(body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return errorResponse('User tidak ditemukan', 404);
    }

    // Check if new email is unique (if email is being changed)
    if (validatedData.email && validatedData.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: validatedData.email },
      });
      if (emailExists) {
        return errorResponse('Email sudah terdaftar', 400);
      }
    }

    // Check if school exists (if schoolId is being changed)
    if (validatedData.schoolId && validatedData.schoolId !== existingUser.schoolId) {
      const school = await prisma.school.findUnique({
        where: { id: validatedData.schoolId },
      });
      if (!school) {
        return errorResponse('Sekolah tidak ditemukan', 404);
      }
    }

    const updateData: any = {};
    if (validatedData.email) updateData.email = validatedData.email;
    if (validatedData.name) updateData.name = validatedData.name;
    if (validatedData.role) updateData.role = validatedData.role;
    if (validatedData.schoolId) updateData.schoolId = validatedData.schoolId;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
    if (validatedData.password) updateData.password = await hashPassword(validatedData.password);

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
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

    // Log without password
    const logData = { ...validatedData };
    delete (logData as any).password;

    await logActivity({
      userId: admin.id,
      action: 'UPDATE',
      resourceType: 'User',
      resourceId: id,
      resourceName: user.name,
      description: `Updated user ${user.name}`,
      newValue: logData,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    console.error('Update user error:', error);
    if (admin) {
      await logActivity({
        userId: admin.id,
        action: 'UPDATE',
        resourceType: 'User',
        resourceId: id,
        description: `Failed to update user`,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
      });
    }
    return errorResponse('Failed to update user', 500);
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Delete a user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin: any;
  let id = '';
  try {
    const result = await params;
    id = result.id;
    admin = await verifyAdmin(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    // Prevent deleting yourself
    const payload = verifyAccessToken(request.headers.get('authorization')?.slice(7) || '');
    if (payload?.userId === id) {
      return errorResponse('Anda tidak bisa menghapus akun sendiri', 400);
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return errorResponse('User tidak ditemukan', 404);
    }

    await prisma.user.delete({
      where: { id },
    });

    await logActivity({
      userId: admin.id,
      action: 'DELETE',
      resourceType: 'User',
      resourceId: id,
      resourceName: existingUser.name,
      description: `Deleted user ${existingUser.name}`,
      oldValue: { email: existingUser.email, name: existingUser.name, role: existingUser.role },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse({ message: 'User berhasil dihapus' });
  } catch (error) {
    console.error('Delete user error:', error);
    if (admin) {
      await logActivity({
        userId: admin.id,
        action: 'DELETE',
        resourceType: 'User',
        resourceId: id,
        description: `Failed to delete user`,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
      });
    }
    return errorResponse('Failed to delete user', 500);
  }
}
