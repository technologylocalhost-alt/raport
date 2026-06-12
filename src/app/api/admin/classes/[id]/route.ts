import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/access';
import { requireMenuAccess } from '@/lib/auth/verify-access';
import { requireEditableClassByPeriod } from '@/lib/auth/class-access';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { serverError } from '@/lib/server-log';

async function requireClassReadAccess(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;

  if (user.role === 'ADMIN' || user.role === 'PRINCIPAL') {
    return requireMenuAccess(req, '/admin/classes', ['ADMIN', 'PRINCIPAL']);
  }

  if (user.role === 'WALI_KELAS') {
    return requireMenuAccess(req, '/wali-kelas/classes', ['WALI_KELAS']);
  }

  if (user.role === 'TEACHER') {
    return requireMenuAccess(req, '/teacher/subjects', ['TEACHER']);
  }

  return null;
}

async function requireClassManagement(req: NextRequest) {
  return requireMenuAccess(req, '/admin/classes', ['ADMIN', 'PRINCIPAL']);
}

const classUpdateSchema = z.object({
  name: z.string().min(1, 'Nama kelas harus diisi').optional(),
  levelId: z.string().optional(),
  schoolYearId: z.string().optional(),
  semesterId: z.string().optional(),
  capacity: z.number().min(1, 'Kapasitas harus lebih dari 0').optional(),
  waliKelasId: z.string().optional(),
  teachers: z.array(z.object({
    teacherId: z.string(),
    subjectId: z.string(),
  })).optional(),
});

/**
 * GET /api/admin/classes/[id]
 * Get a class by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Validation: Check id format
    if (!id || id.trim() === '') {
      return errorResponse('ID Kelas tidak valid', 400);
    }

    const admin = await requireClassReadAccess(request);
    if (!admin) {
      return errorResponse('Token tidak valid atau expired', 401);
    }

    // Verify class exists
    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        level: true,
        schoolYear: { select: { id: true, year: true, isActive: true } },
        semester: { select: { id: true, number: true, isActive: true } },
        waliKelas: { select: { id: true, name: true, email: true } },
        teachers: {
          include: {
            teacher: true,
            subject: true,
          },
        },
        students: {
          select: {
            id: true,
            name: true,
            studentNo: true,
          },
        },
        _count: {
          select: { students: true },
        },
      },
    });

    if (!classData) {
      return errorResponse('Kelas tidak ditemukan', 404);
    }

    // Authorization check
    if (admin.role === 'WALI_KELAS') {
      // WALI_KELAS can access: their own class OR classes where they teach subjects
      const isWaliKelas = classData.waliKelasId === admin.id;
      
      if (!isWaliKelas) {
        // Check if WALI_KELAS also teaches in this class
        const teacherSubjects = await prisma.classTeacher.count({
          where: {
            classId: id,
            teacherId: admin.id,
          },
        });
        
        if (teacherSubjects === 0) {
          return errorResponse('Anda tidak memiliki akses ke kelas ini', 403);
        }
      }
    } else if (admin.role === 'TEACHER') {
      // TEACHER can access classes where they teach subjects
      const teacherSubjects = await prisma.classTeacher.count({
        where: {
          classId: id,
          teacherId: admin.id,
        },
      });
      if (teacherSubjects === 0) {
        return errorResponse('Anda tidak memiliki akses ke kelas ini', 403);
      }
    }
    // ADMIN and PRINCIPAL have access to all classes (no additional check needed)

    return successResponse(classData);
  } catch (error) {
    serverError('Get class error:', error);
    return errorResponse('Gagal memuat data kelas', 500);
  }
}

/**
 * PUT /api/admin/classes/[id]
 * Update a class
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireClassManagement(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    // Only ADMIN and PRINCIPAL can update classes
    if (admin.role !== 'ADMIN' && admin.role !== 'PRINCIPAL') {
      return errorResponse('Forbidden', 403);
    }

    const body = await request.json();
    const validatedData = classUpdateSchema.parse(body);

    // Check if class exists
    const existingClass = await prisma.class.findUnique({
      where: { id },
    });

    if (!existingClass) {
      return errorResponse('Kelas tidak ditemukan', 404);
    }

    const writableClass = await requireEditableClassByPeriod(id);
    if (!writableClass.ok) {
      return errorResponse('Kelas semester lampau hanya dapat dibaca', 403);
    }

    // Prepare update data - use existing values if not provided
    const updateData: Record<string, unknown> = {};
    const newName = validatedData.name || existingClass.name;
    const newLevelId = validatedData.levelId || existingClass.levelId;
    const newSchoolYearId = validatedData.schoolYearId || existingClass.schoolYearId;
    const newSemesterId = validatedData.semesterId || existingClass.semesterId;

    // Check if new combination would violate unique constraint
    // Only check if any of the unique constraint fields are being changed
    if (validatedData.name || validatedData.levelId || validatedData.schoolYearId || validatedData.semesterId) {
      const duplicateClass = await prisma.class.findFirst({
        where: {
          name: newName,
          levelId: newLevelId,
          schoolYearId: newSchoolYearId,
          semesterId: newSemesterId,
          NOT: { id }, // Exclude current class
        },
      });

      if (duplicateClass) {
        return errorResponse(
          'Kelas dengan kombinasi level, tahun ajaran, semester, dan nama yang sama sudah ada',
          400
        );
      }
    }

    // Update class basic info
    if (validatedData.name) updateData.name = validatedData.name;
    if (validatedData.levelId) updateData.levelId = validatedData.levelId;
    if (validatedData.schoolYearId) updateData.schoolYearId = validatedData.schoolYearId;
    if (validatedData.semesterId) updateData.semesterId = validatedData.semesterId;
    if (validatedData.capacity) updateData.capacity = validatedData.capacity;
    if (validatedData.waliKelasId !== undefined) updateData.waliKelasId = validatedData.waliKelasId || null;

    let updatedClass;
    try {
      updatedClass = await prisma.class.update({
        where: { id },
        data: updateData,
        include: {
          level: true,
          schoolYear: true,
          semester: true,
          waliKelas: { select: { id: true, name: true, email: true } },
          teachers: {
            include: {
              teacher: true,
              subject: true,
            },
          },
          _count: { select: { students: true } },
        },
      });
    } catch (error: unknown) {
      // Handle unique constraint violation
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        return errorResponse(
          'Kelas dengan kombinasi level, tahun ajaran, semester, dan nama yang sama sudah ada. Silakan gunakan nama kelas yang berbeda.',
          400
        );
      }
      throw error;
    }

    // Update teachers if provided
    if (validatedData.teachers) {
      // Delete existing teachers
      await prisma.classTeacher.deleteMany({
        where: { classId: id },
      });

      // Add new teachers
      for (const teacherData of validatedData.teachers) {
        await prisma.classTeacher.create({
          data: {
            classId: id,
            teacherId: teacherData.teacherId,
            subjectId: teacherData.subjectId,
          },
        });
      }
    }

    await logActivity({
      userId: admin.id,
      action: 'UPDATE',
      resourceType: 'Class',
      resourceId: id,
      resourceName: updatedClass.name,
      description: `Updated class: ${updatedClass.name}`,
      newValue: updateData,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(updatedClass);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    serverError('Update class error:', error);
    return errorResponse('Failed to update class', 500);
  }
}

/**
 * DELETE /api/admin/classes/[id]
 * Delete a class
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireClassManagement(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    // Only ADMIN and PRINCIPAL can delete classes
    if (admin.role !== 'ADMIN' && admin.role !== 'PRINCIPAL') {
      return errorResponse('Forbidden', 403);
    }

    // Check if class exists
    const existingClass = await prisma.class.findUnique({
      where: { id },
      include: {
        _count: { select: { students: true } },
      },
    });

    if (!existingClass) {
      return errorResponse('Kelas tidak ditemukan', 404);
    }

    const writableClass = await requireEditableClassByPeriod(id);
    if (!writableClass.ok) {
      return errorResponse('Kelas semester lampau hanya dapat dibaca', 403);
    }

    // Check if class has students
    if (existingClass._count.students > 0) {
      return errorResponse('Tidak bisa menghapus kelas yang memiliki siswa', 400);
    }

    await prisma.class.delete({
      where: { id },
    });

    await logActivity({
      userId: admin.id,
      action: 'DELETE',
      resourceType: 'Class',
      resourceId: id,
      resourceName: existingClass.name,
      description: `Deleted class: ${existingClass.name}`,
      oldValue: {
        name: existingClass.name,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse({ message: 'Kelas berhasil dihapus' });
  } catch (error) {
    serverError('Delete class error:', error);
    return errorResponse('Failed to delete class', 500);
  }
}
