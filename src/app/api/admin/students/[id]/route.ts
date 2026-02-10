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
