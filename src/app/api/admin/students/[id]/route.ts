import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth/access';
import { requireEditableClassByPeriod } from '@/lib/auth/class-access';
import { requireMenuAccess } from '@/lib/auth/verify-access';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { serverError } from '@/lib/server-log';

async function requireStudentReadWrite(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;

  if (user.role === 'ADMIN' || user.role === 'PRINCIPAL') {
    return requireMenuAccess(req, '/admin/students', ['ADMIN', 'PRINCIPAL']);
  }

  if (user.role === 'WALI_KELAS') {
    return requireMenuAccess(req, '/wali-kelas/classes', ['WALI_KELAS']);
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
    const admin = await requireStudentReadWrite(request);

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
    serverError('Error fetching student:', error);
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
  let admin;
  let id = '';
  try {
    const result = await params;
    id = result.id;
    admin = await requireStudentReadWrite(request);

    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    const student = await prisma.student.findUnique({
      where: { id },
    });

    if (!student) {
      return errorResponse('Siswa tidak ditemukan', 404);
    }

    const currentClassWritable = await requireEditableClassByPeriod(student.classId);
    if (!currentClassWritable.ok) {
      return errorResponse('Kelas semester lampau hanya dapat dibaca', 403);
    }

    const body = await request.json();
    const { name, studentNo, nourut, email, phone, address, birthDate, classId, parentPhoneNo } = body;

    if (classId && classId !== student.classId) {
      const targetClassWritable = await requireEditableClassByPeriod(classId);
      if (!targetClassWritable.ok) {
        return errorResponse('Kelas semester lampau hanya dapat dibaca', 403);
      }
    }

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

    await logActivity({
      userId: admin.id,
      action: 'UPDATE',
      resourceType: 'Student',
      resourceId: id,
      resourceName: updatedStudent.name,
      description: `Updated student ${updatedStudent.name}`,
      newValue: body,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
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
    serverError('Error updating student:', error);
    if (admin) {
      await logActivity({
        userId: admin.id,
      action: 'UPDATE',
      resourceType: 'Student',
      resourceId: id,
      description: `Failed to update student`,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
        status: 'FAILED',
      });
    }
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
  let admin;
  let id = '';
  try {
    const result = await params;
    id = result.id;
    admin = await requireStudentReadWrite(request);

    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    const student = await prisma.student.findUnique({
      where: { id },
    });

    if (!student) {
      return errorResponse('Siswa tidak ditemukan', 404);
    }

    const currentClassWritable = await requireEditableClassByPeriod(student.classId);
    if (!currentClassWritable.ok) {
      return errorResponse('Kelas semester lampau hanya dapat dibaca', 403);
    }

    await prisma.student.delete({
      where: { id },
    });

    await logActivity({
      userId: admin.id,
      action: 'DELETE',
      resourceType: 'Student',
      resourceId: id,
      resourceName: student.name,
      description: `Deleted student ${student.name}`,
      oldValue: student,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(null, 'Siswa berhasil dihapus');
  } catch (error) {
    serverError('Error deleting student:', error);
    if (admin) {
      await logActivity({
        userId: admin.id,
        action: 'DELETE',
        resourceType: 'Student',
        resourceId: id,
        description: `Failed to delete student`,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
      });
    }
    return errorResponse('Gagal menghapus data siswa', 500);
  }
}
