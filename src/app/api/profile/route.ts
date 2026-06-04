import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth/access';
import { hashPassword } from '@/lib/auth/password';
import { z } from 'zod';
import bcryptjs from 'bcryptjs';
import { serverError } from '@/lib/server-log';

// Schema for updating profile
const updateProfileSchema = z.object({
  name: z.string().min(1, 'Nama harus diisi').optional(),
  email: z.string().email('Email tidak valid').optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, 'Password minimal 6 karakter').optional(),
});

async function getUser(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);

  if (!authUser) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      schoolId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      school: {
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          email: true,
          npsn: true,
        },
      },
    },
  });

  return user;
}

/**
 * GET /api/profile
 * Get current user profile
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    serverError('[Profile] Get error:', error);
    return NextResponse.json(
      { error: 'Failed to get profile' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/profile
 * Update current user profile
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, email, currentPassword, newPassword } = validation.data;

    // Prepare update data
    const updateData: Record<string, string> = {};

    if (name) {
      updateData.name = name;
    }

    if (email && email !== user.email) {
      // Check if email is already taken
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'Email sudah digunakan' },
          { status: 400 }
        );
      }

      updateData.email = email;
    }

    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Password lama harus diisi' },
          { status: 400 }
        );
      }

      // Get user with password
      const userWithPassword = await prisma.user.findUnique({
        where: { id: user.id },
      });

      if (!userWithPassword) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Verify current password
      const isPasswordValid = await bcryptjs.compare(currentPassword, userWithPassword.password);

      if (!isPasswordValid) {
        return NextResponse.json(
          { error: 'Password lama salah' },
          { status: 400 }
        );
      }

      // Hash new password
      updateData.password = await hashPassword(newPassword);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        schoolId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        school: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            email: true,
            npsn: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Profile berhasil diperbarui',
      data: updatedUser,
    });
  } catch (error) {
    serverError('[Profile] Update error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
