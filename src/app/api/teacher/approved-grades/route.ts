import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTeacherOnly } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

export async function GET(request: NextRequest) {
  try {
    const user = await requireTeacherOnly(request);
    if (!user) {
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
    serverError('Error fetching approved grades:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memuat nilai yang disetujui' },
      { status: 500 }
    );
  }
}
