import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

async function getTeacher(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    const teacher = await prisma.user.findUnique({
      where: { id: decoded.id },
    });
    return teacher;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const teacher = await getTeacher(req);
    if (!teacher || teacher.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');

    const skip = (page - 1) * limit;

    // Get students from teacher's classes
    const teacherClasses = await prisma.classTeacher.findMany({
      where: { teacherId: teacher.id },
      distinct: ['classId'],
      select: { classId: true },
    });

    const classIds = teacherClasses.map((ct) => ct.classId);

    // Get students with their enrollment info
    const whereClause: any = {
      classId: { in: classIds },
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { studentNo: { contains: search, mode: 'insensitive' } },
        { class: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const students = await prisma.student.findMany({
      where: whereClause,
      include: {
        class: {
          include: {
            level: true,
            schoolYear: true,
            semester: true,
          },
        },
        grades: {
          include: {
            competency: {
              include: {
                subject: true,
              },
            },
          },
        },
      },
      skip,
      take: limit,
      orderBy: { name: 'asc' },
    });

    const total = await prisma.student.count({ where: whereClause });

    // Transform students into report-like structure
    const reports = students.map((student) => {
      // Determine report status based on grades
      const hasGrades = student.grades.length > 0;
      let reportStatus = 'draft';

      if (hasGrades) {
        reportStatus = 'completed';
      }

      return {
        id: student.id,
        nisn: student.studentNo,
        name: student.name,
        className: student.class.name,
        semester: student.class.semester.number,
        year: student.class.schoolYear.year,
        status: reportStatus,
        createdDate: student.grades[0]?.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        gradeCount: student.grades.length,
      };
    });

    // Filter by status if provided
    const filteredReports = status
      ? reports.filter((r) => r.status === status)
      : reports;

    return NextResponse.json({
      success: true,
      data: filteredReports,
      page,
      limit,
      total: filteredReports.length,
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const teacher = await getTeacher(req);
    if (!teacher || teacher.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    // Get student with their grades
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        class: {
          include: {
            level: true,
            schoolYear: true,
            semester: true,
          },
        },
        grades: {
          where: { teacherId: teacher.id },
          include: {
            competency: {
              include: {
                subject: true,
              },
            },
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Verify teacher has access
    const classTeacher = await prisma.classTeacher.findFirst({
      where: { classId: student.classId, teacherId: teacher.id },
    });

    if (!classTeacher) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Generate report data
    const report = {
      id: student.id,
      nisn: student.studentNo,
      name: student.name,
      className: student.class.name,
      levelName: student.class.level.name,
      semester: student.class.semester.number,
      year: student.class.schoolYear.year,
      grades: student.grades,
      generatedDate: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
