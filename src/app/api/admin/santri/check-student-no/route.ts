import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { requireAdminOrPrincipal } from '@/lib/auth/admin-access';
import { serverError } from '@/lib/server-log';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdminOrPrincipal(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const studentNo = (request.nextUrl.searchParams.get('studentNo') || '').trim();
    const excludeId = request.nextUrl.searchParams.get('excludeId') || '';

    if (!studentNo) {
      return errorResponse('studentNo wajib diisi', 400);
    }

    const where = excludeId
      ? {
          studentNo,
          id: { not: excludeId },
        }
      : {
          studentNo,
        };

    const [santri, student] = await Promise.all([
      prisma.santri.findFirst({
        where,
        select: {
          id: true,
          studentNo: true,
          name: true,
          gender: true,
          birthDate: true,
          phone: true,
          address: true,
          parentPhoneNo: true,
        },
      }),
      prisma.student.findFirst({
        where: { studentNo },
        orderBy: { updatedAt: 'desc' },
        select: {
          studentNo: true,
          name: true,
          gender: true,
          birthDate: true,
          phone: true,
          address: true,
          parentPhoneNo: true,
        },
      }),
    ]);

    return successResponse({
      exists: !!santri,
      studentNo,
      source: santri ? 'santri' : (student ? 'student' : 'none'),
      santri: santri
        ? {
            name: santri.name,
            gender: santri.gender,
            birthDate: santri.birthDate ? santri.birthDate.toISOString() : null,
            phone: santri.phone,
            address: santri.address,
            parentPhoneNo: santri.parentPhoneNo,
          }
        : null,
      student: student
        ? {
            studentNo: student.studentNo,
            name: student.name,
            gender: student.gender,
            birthDate: student.birthDate ? student.birthDate.toISOString() : null,
            phone: student.phone,
            address: student.address,
            parentPhoneNo: student.parentPhoneNo,
          }
        : null,
    });
  } catch (error) {
    serverError('Error checking studentNo:', error);
    return errorResponse('Gagal mengecek No Stambuk', 500);
  }
}
