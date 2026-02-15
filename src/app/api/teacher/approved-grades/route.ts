import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token tidak ditemukan' }, { status: 401 });
    }

    const decoded = verifyAccessToken(token);
    if (!decoded || decoded.role !== 'TEACHER') {
      return NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const subjectId = searchParams.get('subjectId');

    if (!studentId || !subjectId) {
      return NextResponse.json(
        { success: false, error: 'studentId dan subjectId diperlukan' },
        { status: 400 }
      );
    }

    // Fetch approved grades from NilaiApprove table
    const approvedGrades = await prisma.nilaiApprove.findMany({
      where: {
        studentId,
        subjectId,
      },
      select: {
        id: true,
        competencyId: true,
        assessmentType: true,
        score: true,
        notes: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: approvedGrades,
    });
  } catch (error) {
    console.error('Error fetching approved grades:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memuat nilai yang disetujui' },
      { status: 500 }
    );
  }
}
