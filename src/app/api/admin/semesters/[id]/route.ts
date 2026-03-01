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
  
  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL')) {
    return user;
  }
  return null;
}

const semesterUpdateSchema = z.object({
  number: z.number().min(1, 'Nomor semester harus 1 atau 2').max(2).optional(),
  semesterLabel: z.string().optional().nullable(),
  semesterLabelArabic: z.string().optional().nullable(),
  startDate: z.string().min(1, 'Tanggal mulai harus diisi').optional(),
  endDate: z.string().min(1, 'Tanggal selesai harus diisi').optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/admin/semesters/[id]
 * Get a semester by ID
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

    const semester = await prisma.semester.findUnique({
      where: { id },
      include: {
        schoolYear: true,
        classes: {
          select: {
            id: true,
            name: true,
            level: { select: { name: true } },
          },
        },
        _count: {
          select: { classes: true },
        },
      },
    });

    if (!semester) {
      return errorResponse('Semester tidak ditemukan', 404);
    }

    return successResponse(semester);
  } catch (error) {
    console.error('Get semester error:', error);
    return errorResponse('Failed to fetch semester', 500);
  }
}

/**
 * PUT /api/admin/semesters/[id]
 * Update a semester
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

    const body = await request.json();
    const validatedData = semesterUpdateSchema.parse(body);

    // Check if semester exists
    const existingSemester = await prisma.semester.findUnique({
      where: { id },
    });

    if (!existingSemester) {
      return errorResponse('Semester tidak ditemukan', 404);
    }

    // If changing semester number, check if new number already exists for same school year
    if (validatedData.number && validatedData.number !== existingSemester.number) {
      const duplicateSemester = await prisma.semester.findFirst({
        where: {
          schoolYearId: existingSemester.schoolYearId,
          number: validatedData.number,
          id: { not: id },
        },
      });

      if (duplicateSemester) {
        return errorResponse(
          `Semester ${validatedData.number} sudah ada untuk tahun akademik ini`,
          400
        );
      }
    }

    const updateData: any = {};
    if (validatedData.number !== undefined) updateData.number = validatedData.number;
    if (validatedData.semesterLabelArabic !== undefined) {
      updateData.semesterLabelArabic = validatedData.semesterLabelArabic || null;
    }
    if (validatedData.startDate) updateData.startDate = new Date(validatedData.startDate);
    if (validatedData.endDate) updateData.endDate = new Date(validatedData.endDate);
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;

    const semester = await prisma.semester.update({
      where: { id },
      data: updateData,
      include: {
        schoolYear: true,
        _count: { select: { classes: true } },
      },
    });

    return successResponse(semester);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      console.error('Semester update validation errors:', fieldErrors);
      return errorResponse('Validation error', 400, fieldErrors);
    }
    console.error('Update semester error:', error);
    return errorResponse('Failed to update semester', 500);
  }
}

/**
 * DELETE /api/admin/semesters/[id]
 * Delete a semester
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

    // Check if semester exists
    const existingSemester = await prisma.semester.findUnique({
      where: { id },
      include: {
        _count: { select: { classes: true } },
      },
    });

    if (!existingSemester) {
      return errorResponse('Semester tidak ditemukan', 404);
    }

    // Check if semester has any classes
    if (existingSemester._count.classes > 0) {
      return errorResponse(
        'Tidak bisa menghapus semester yang memiliki kelas. Hapus semua kelas terlebih dahulu.',
        400
      );
    }

    await prisma.semester.delete({
      where: { id },
    });

    return successResponse({ message: 'Semester berhasil dihapus' });
  } catch (error) {
    console.error('Delete semester error:', error);
    return errorResponse('Failed to delete semester', 500);
  }
}
