import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTeacherOnly } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

export async function GET(request: NextRequest) {
  try {
    const teacher = await requireTeacherOnly(request);
    if (!teacher) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get subjectId from query parameters (optional)
    const subjectId = request.nextUrl.searchParams.get('subjectId');

    // If subjectId is provided, filter by that specific subject
    if (subjectId) {
      const competencies = await prisma.competency.findMany({
        where: {
          subjectId: subjectId,
          teacherId: teacher.id,
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
    }

    // Get all subjects taught by the teacher
    const teacherSubjects = await prisma.classTeacher.findMany({
      where: {
        teacherId: teacher.id,
      },
      select: {
        subjectId: true,
      },
      distinct: ['subjectId'],
    });

    const subjectIds = teacherSubjects.map((ct) => ct.subjectId);

    // Get competencies for these subjects, filtered by this teacher only
    const competencies = await prisma.competency.findMany({
      where: {
        subjectId: {
          in: subjectIds,
        },
        teacherId: teacher.id,
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
    serverError('Error fetching teacher competencies:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch competencies' },
      { status: 500 }
    );
  }
}
