import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
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

  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL' || user.role === 'WALI_KELAS')) {
    return user;
  }
  return null;
}

/**
 * GET /api/admin/students/[id]
 * Get a student by ID
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

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        class: {
          include: {
            level: true,
            schoolYear: true,
          },
        },
      },
    });

    if (!student) {
      return errorResponse('Siswa tidak ditemukan', 404);
    }

    return successResponse({
      id: student.id,
      name: student.name,
      nisn: student.studentNo,
      studentNo: student.studentNo,
      email: student.email,
      phone: student.phone,
      birthDate: student.birthDate,
      address: student.address,
      parentPhoneNo: student.parentPhoneNo,
      classId: student.classId,
      className: student.class?.name || '-',
    });
  } catch (error) {
    console.error('Error fetching student:', error);
    return errorResponse('Gagal memuat data siswa', 500);
  }
}

/**
 * PUT /api/admin/students/[id]
 * Update a student
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

    const student = await prisma.student.findUnique({
      where: { id },
    });

    if (!student) {
      return errorResponse('Siswa tidak ditemukan', 404);
    }

    const body = await request.json();
    const { name, studentNo, nourut, email, phone, address, birthDate, classId, parentPhoneNo } = body;

    const updatedStudent = await prisma.student.update({
      where: { id },
      data: {
        name,
        studentNo,
        nourut: nourut || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        classId,
        parentPhoneNo: parentPhoneNo || null,
      },
      include: {
        class: {
          include: {
            level: true,
            schoolYear: true,
          },
        },
      },
    });

    return successResponse({
      id: updatedStudent.id,
      name: updatedStudent.name,
      studentNo: updatedStudent.studentNo,
      email: updatedStudent.email,
      phone: updatedStudent.phone,
      address: updatedStudent.address,
      birthDate: updatedStudent.birthDate,
      className: updatedStudent.class?.name || '-',
      classId: updatedStudent.classId,
    });
  } catch (error) {
    console.error('Error updating student:', error);
    return errorResponse('Gagal mengubah data siswa', 500);
  }
}

/**
 * DELETE /api/admin/students/[id]
 * Delete a student
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

    const student = await prisma.student.findUnique({
      where: { id },
    });

    if (!student) {
      return errorResponse('Siswa tidak ditemukan', 404);
    }

    await prisma.student.delete({
      where: { id },
    });

    return successResponse(null, 'Siswa berhasil dihapus');
  } catch (error) {
    console.error('Error deleting student:', error);
    return errorResponse('Gagal menghapus data siswa', 500);
  }
}
