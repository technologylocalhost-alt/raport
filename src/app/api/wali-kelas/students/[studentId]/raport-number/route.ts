import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTeacherWaliAdminPrincipal } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ studentId: string }> }
) {
  try {
    const user = await requireTeacherWaliAdminPrincipal(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Token tidak valid', data: null },
        { status: 401 }
      );
    }
    const { studentId } = await context.params;

    // Get raport number from NilaiApprove - get distinct nomorRaport for this student
    const nilaiApproveRecords = await prisma.nilaiApprove.findMany({
      where: {
        studentId: studentId,
        nomorRaport: {
          not: null,
        },
      },
      select: {
        nomorRaport: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1,
    });

    const nomorRaport = nilaiApproveRecords.length > 0 
      ? nilaiApproveRecords[0].nomorRaport 
      : null;

    return NextResponse.json(
      { 
        success: true, 
        message: 'Berhasil mengambil nomor raport', 
        data: {
          nomorRaport: nomorRaport,
          studentId: studentId, // untuk debugging
        }
      },
      { status: 200 }
    );
  } catch (error) {
    serverError('Error fetching raport number:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server', data: null },
      { status: 500 }
    );
  }
}
