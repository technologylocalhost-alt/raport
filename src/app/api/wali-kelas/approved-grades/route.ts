import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireWaliKelasOnly } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

export async function GET(request: NextRequest) {
  try {
    const user = await requireWaliKelasOnly(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const subjectId = searchParams.get('subjectId');
    const classId = searchParams.get('classId');

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
        ...(classId ? { classId } : {}),
      },
      select: {
        id: true,
        competencyId: true,
        assessmentType: true,
        score: true,
        notes: true,
        createdAt: true,
      },
      orderBy: [
        { assessmentType: 'asc' },
        { competencyId: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: approvedGrades,
    });
  } catch (error) {
    serverError('Error fetching approved grades:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memuat nilai yang disetujui' },
      { status: 500 }
    );
  }
}
