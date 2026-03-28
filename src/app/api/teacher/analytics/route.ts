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

async function getTeacherStats(teacherId: string) {
  // Get teacher's classes
  const classTeachers = await prisma.classTeacher.findMany({
    where: { teacherId },
    include: { class: { include: { _count: { select: { students: true } } } } }
  });

  if (classTeachers.length === 0) {
    return {
      totalClasses: 0,
      totalStudents: 0,
      totalSubjects: 0,
      averageAttendance: 0,
      gradesSubmitted: 0,
      pendingGrades: 0
    };
  }

  const classIds = classTeachers.map(ct => ct.classId);

  // Count total students
  const totalStudents = await prisma.student.count({
    where: { classId: { in: classIds } }
  });

  // Count unique subjects
  const subjects = await prisma.classTeacher.findMany({
    where: { teacherId },
    distinct: ['subjectId'],
    select: { subjectId: true }
  });
  const totalSubjects = subjects.length;

  // Calculate average attendance
  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      student: { classId: { in: classIds } }
    }
  });

  const attendanceRate = attendanceRecords.length > 0
    ? Math.round((attendanceRecords.filter(a => a.status === 'HADIR').length / attendanceRecords.length) * 100)
    : 0;

  // Count submitted grades
  const gradesSubmitted = await prisma.grade.count({
    where: {
      teacherId,
      createdAt: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) }
    }
  });

  // Count pending grades (students in classes without grades this month)
  const students = await prisma.student.findMany({
    where: { classId: { in: classIds } },
    select: { id: true }
  });

  const studentIds = students.map(s => s.id);
  const studentsWithGrades = await prisma.grade.findMany({
    where: {
      studentId: { in: studentIds },
      teacherId,
      createdAt: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) }
    },
    distinct: ['studentId'],
    select: { studentId: true }
  });

  const pendingGrades = Math.max(0, studentIds.length - studentsWithGrades.length);

  return {
    totalClasses: classTeachers.length,
    totalStudents,
    totalSubjects,
    averageAttendance: attendanceRate,
    gradesSubmitted,
    pendingGrades
  };
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const teacher = await getTeacher(token);
    const stats = await getTeacherStats(teacher.id);

    return NextResponse.json({ data: stats });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
