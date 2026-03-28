import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ studentId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Token tidak ditemukan', data: null },
        { status: 401 }
      );
    }
    const payload = await verifyAccessToken(token);
    if (!payload) {
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

    // Log untuk debugging
    console.log(`Student ID: ${studentId}, Nomor Raport: ${nomorRaport}`);

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
    console.error('Error fetching raport number:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server', data: null },
      { status: 500 }
    );
  }
}
