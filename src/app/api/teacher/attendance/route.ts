import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';

async function getTeacher(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    return null;
  }

  const teacher = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  // Allow both TEACHER and WALI_KELAS roles
  if (teacher && (teacher.role === 'TEACHER' || teacher.role === 'WALI_KELAS')) {
    return teacher;
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const teacher = await getTeacher(req);
    if (!teacher) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const date = searchParams.get('date');
    const classId = searchParams.get('classId');

    const skip = (page - 1) * limit;

    let classIds: string[] = [];

    // Handle WALI_KELAS with specific classId
    if (teacher.role === 'WALI_KELAS' && classId) {
      // Verify that the wali kelas owns this class
      const classRecord = await prisma.class.findUnique({
        where: { id: classId },
      });

      if (classRecord?.waliKelasId === teacher.id) {
        classIds = [classId];
      } else {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else if (teacher.role === 'TEACHER') {
      // Get students from teacher's classes
      const teacherClasses = await prisma.classTeacher.findMany({
        where: { teacherId: teacher.id },
        distinct: ['classId'],
        select: { classId: true },
      });

      classIds = teacherClasses.map((ct) => ct.classId);
    }

    if (classIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        page,
        limit,
        total: 0,
      });
    }

    const whereClause: any = {
      student: {
        classId: { in: classIds },
      },
    };

    if (search) {
      whereClause.student.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { studentNo: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);

      whereClause.date = {
        gte: startDate,
        lt: endDate,
      };
    }

    const attendance = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        student: true,
      },
      skip,
      take: limit,
      orderBy: { date: 'desc' },
    });

    const total = await prisma.attendance.count({ where: whereClause });

    return NextResponse.json({
      success: true,
      data: attendance.map((a) => ({
        id: a.id,
        studentId: a.student.id,
        studentName: a.student.name,
        nisn: a.student.studentNo,
        date: a.date.toISOString().split('T')[0],
        status: a.status,
        notes: a.notes,
      })),
      page,
      limit,
      total,
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let teacher: any;
  try {
    teacher = await getTeacher(req);
    if (!teacher) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { studentId, date, status, notes } = body;

    if (!studentId || !date || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify teacher has access to this student
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { class: true },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Check authorization based on role
    if (teacher.role === 'TEACHER') {
      const classTeacher = await prisma.classTeacher.findFirst({
        where: { classId: student.classId, teacherId: teacher.id },
      });

      if (!classTeacher) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    } else if (teacher.role === 'WALI_KELAS') {
      // Verify wali kelas owns the student's class
      const classRecord = await prisma.class.findUnique({
        where: { id: student.classId },
      });

      if (classRecord?.waliKelasId !== teacher.id) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    const attendanceDate = new Date(date);

    // Check if attendance already exists
    const existing = await prisma.attendance.findUnique({
      where: {
        studentId_date: {
          studentId,
          date: attendanceDate,
        },
      },
    });

    if (existing) {
      // Update existing
      const updated = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status,
          notes,
        },
        include: { student: true },
      });

      await logActivity({
        userId: teacher.id,
        action: 'UPDATE',
        resourceType: 'Attendance',
        resourceId: updated.id,
        resourceName: `${updated.student.name} - ${new Date(updated.date).toLocaleDateString()}`,
        description: `Updated attendance for ${updated.student.name}`,
        newValue: { status, notes },
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
        status: 'SUCCESS',
      });

      return NextResponse.json({
        success: true,
        data: updated,
      });
    }

    // Create new
    const attendance = await prisma.attendance.create({
      data: {
        studentId,
        date: attendanceDate,
        status,
        notes,
      },
      include: { student: true },
    });

    await logActivity({
      userId: teacher.id,
      action: 'CREATE',
      resourceType: 'Attendance',
      resourceId: attendance.id,
      resourceName: `${attendance.student.name} - ${new Date(attendance.date).toLocaleDateString()}`,
      description: `Created attendance record for ${attendance.student.name}`,
      newValue: { studentId, date: attendanceDate, status, notes },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    console.error('Error creating attendance:', error);
    await logActivity({
      userId: teacher?.id || 'unknown',
      action: 'CREATE',
      resourceType: 'Attendance',
      resourceId: '',
      description: `Failed to create attendance record`,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      status: 'FAILED',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
