import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth/jwt';

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
  
  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL' || user.role === 'WALI_KELAS' || user.role === 'TEACHER')) {
    return user;
  }
  return null;
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

    const admin = await verifyAdmin(request);
    if (!admin) {
      return errorResponse('Token tidak valid atau expired', 401);
    }

    // Verify class exists
    const classData = await prisma.class.findUnique({
      where: { id },
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
    console.error('Get class error:', error);
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
    const admin = await verifyAdmin(request);
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

    // Update class basic info
    const updateData: any = {};
    if (validatedData.name) updateData.name = validatedData.name;
    if (validatedData.levelId) updateData.levelId = validatedData.levelId;
    if (validatedData.schoolYearId) updateData.schoolYearId = validatedData.schoolYearId;
    if (validatedData.semesterId) updateData.semesterId = validatedData.semesterId;
    if (validatedData.capacity) updateData.capacity = validatedData.capacity;
    if (validatedData.waliKelasId !== undefined) updateData.waliKelasId = validatedData.waliKelasId || null;

    const updatedClass = await prisma.class.update({
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

    return successResponse(updatedClass);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    console.error('Update class error:', error);
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
    const admin = await verifyAdmin(request);
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

    // Check if class has students
    if (existingClass._count.students > 0) {
      return errorResponse('Tidak bisa menghapus kelas yang memiliki siswa', 400);
    }

    await prisma.class.delete({
      where: { id },
    });

    return successResponse({ message: 'Kelas berhasil dihapus' });
  } catch (error) {
    console.error('Delete class error:', error);
    return errorResponse('Failed to delete class', 500);
  }
}
