import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = verifyAccessToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id: studentId } = await params;
    const classId = request.nextUrl.searchParams.get('classId');
    const semesterId = request.nextUrl.searchParams.get('semesterId');

    if (!classId) {
      return NextResponse.json({ error: 'classId is required' }, { status: 400 });
    }

    // Verify student belongs to class
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { class: true },
    });

    if (!student || student.classId !== classId) {
      return NextResponse.json({ error: 'Student not found in class' }, { status: 404 });
    }

    // Get attendance data
    let whereClause: any = {
      studentId: studentId,
    };

    // If semesterId provided, filter by semester date range
    if (semesterId) {
      const semester = await prisma.semester.findUnique({
        where: { id: semesterId },
      });

      if (semester) {
        whereClause.date = {
          gte: semester.startDate,
          lte: semester.endDate,
        };
      }
    }

    const attendances = await prisma.attendance.findMany({
      where: whereClause,
      orderBy: { date: 'asc' },
    });

    // Count by status
    const summary = {
      HADIR: attendances.filter((a) => a.status === 'HADIR').length,
      SAKIT: attendances.filter((a) => a.status === 'SAKIT').length,
      IZIN: attendances.filter((a) => a.status === 'IZIN').length,
      ALFA: attendances.filter((a) => a.status === 'ALFA').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        summary,
        total: attendances.length,
        details: attendances,
      },
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
