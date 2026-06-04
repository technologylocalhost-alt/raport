import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireWaliKelasOnly } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

export async function GET(request: NextRequest) {
  try {
    const user = await requireWaliKelasOnly(request);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Forbidden: Only WALI_KELAS can access this' },
        { status: 403 }
      );
    }

    // Get subjectId from query parameters
    const subjectId = request.nextUrl.searchParams.get('subjectId');

    if (!subjectId) {
      return NextResponse.json(
        { success: false, message: 'subjectId query parameter is required' },
        { status: 400 }
      );
    }

    // Get competencies for the specific subject
    // Include all competencies: both unassigned (teacherId null) and assigned to any teacher
    const competencies = await prisma.competency.findMany({
      where: {
        subjectId: subjectId,
        // Removed teacherId filter to show all competencies for the subject
      },
      select: {
        id: true,
        name: true,
        code: true,
        subjectId: true,
        type: true,
        subject: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Transform the data
    const transformedCompetencies = competencies.map((comp) => ({
      id: comp.id,
      name: comp.name,
      code: comp.code,
      subjectId: comp.subjectId,
      type: comp.type,
      subjectName: comp.subject?.name || '',
      subjectCode: comp.subject?.code || '',
    }));

    return NextResponse.json({
      success: true,
      competencies: transformedCompetencies,
      total: transformedCompetencies.length,
    });
  } catch (error) {
    serverError('Error fetching wali-kelas competencies:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch competencies' },
      { status: 500 }
    );
  }
}
