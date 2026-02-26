import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';

async function getTeacher(token: string) {
  const payload = verifyAccessToken(token);
  if (!payload) throw new Error('Invalid token');
  
  const teacher = await prisma.user.findUnique({
    where: { id: payload.userId },
  });
  
  if (!teacher || teacher.role !== 'TEACHER') throw new Error('Not a teacher');
  return teacher;
}

async function getClassesAnalytics(teacherId: string, classId?: string) {
  const classTeachers = await prisma.classTeacher.findMany({
    where: {
      teacherId,
      ...(classId && { classId })
    },
    include: {
      class: {
        include: {
          _count: { select: { students: true } }
        }
      }
    }
  });

  const classesData = await Promise.all(
    classTeachers.map(async (ct) => {
      const classStudents = await prisma.student.findMany({
        where: { classId: ct.classId },
        select: { id: true }
      });

      const studentIds = classStudents.map(s => s.id);

      // Calculate attendance rate
      const attendanceRecords = await prisma.attendance.findMany({
        where: { studentId: { in: studentIds } }
      });

      const attendanceRate = attendanceRecords.length > 0
        ? Math.round((attendanceRecords.filter(a => a.status === 'HADIR').length / attendanceRecords.length) * 100)
        : 0;

      // Calculate grades completed percentage
      const gradesRecords = await prisma.grade.findMany({
        where: {
          studentId: { in: studentIds },
          teacherId
        },
        distinct: ['studentId'],
        select: { studentId: true }
      });

      const gradesCompleted = studentIds.length > 0
        ? Math.round((gradesRecords.length / studentIds.length) * 100)
        : 0;

      return {
        id: ct.classId,
        name: ct.class.name,
        studentCount: studentIds.length,
        attendanceRate,
        gradesCompleted
      };
    })
  );

  return classesData;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const teacher = await getTeacher(token);

    const searchParams = request.nextUrl.searchParams;
    const classId = searchParams.get('classId') || undefined;

    const data = await getClassesAnalytics(teacher.id, classId);

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Classes analytics error:', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
