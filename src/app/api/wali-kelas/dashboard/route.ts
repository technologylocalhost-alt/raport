import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireWaliKelasOnly } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

interface Activity {
  id: string;
  type: 'grade' | 'attendance' | 'competency';
  title: string;
  description: string;
  timestamp: string;
  activityType: 'success' | 'info' | 'warning';
}

async function requireWaliKelasAccess(request: NextRequest) {
  return requireWaliKelasOnly(request);
}

async function getRecentActivities(classId: string): Promise<Activity[]> {
  // Get recent grades
  const recentGrades = await prisma.grade.findMany({
    where: {
      student: { classId },
    },
    include: {
      student: true,
      teacher: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  // Get recent attendance
  const recentAttendance = await prisma.attendance.findMany({
    where: {
      student: { classId },
    },
    include: {
      student: true,
    },
    orderBy: { date: 'desc' },
    take: 5,
  });

  const activities: Activity[] = [
    ...recentGrades.map((g) => ({
      id: g.id,
      type: 'grade' as const,
      title: `Nilai ${g.student.name}`,
      description: `${g.teacher?.name || 'Guru'} memberikan nilai`,
      timestamp: g.createdAt.toISOString(),
      activityType: 'success' as const,
    })),
    ...recentAttendance.map((a) => ({
      id: a.id,
      type: 'attendance' as const,
      title: `Absensi ${a.student.name}`,
      description: `Status: ${a.status}`,
      timestamp: a.date.toISOString(),
      activityType: a.status === 'HADIR' ? ('success' as const) : ('warning' as const),
    })),
  ];

  return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);
}

async function getWaliKelasStats(waliKelasId: string) {
  // Get the class where user is wali kelas
  const class_ = await prisma.class.findFirst({
    where: { waliKelasId },
    include: {
      _count: {
        select: {
          students: true,
        }
      }
    }
  });

  if (!class_) {
    return {
      className: 'Belum ditugaskan',
      totalStudents: 0,
      totalSubjects: 0,
      presentToday: 0,
      attendanceRate: 0,
      recentActivities: [],
      subjectTeachers: [],
    };
  }

  // Get subjects and teachers for this class
  const subjectTeachers = await prisma.classTeacher.findMany({
    where: { classId: class_.id },
    include: {
      subject: true,
      teacher: true,
    },
    orderBy: { subject: { name: 'asc' } },
  });

  const subjects = subjectTeachers.map((st) => ({
    subjectId: st.subject.id,
    subjectName: st.subject.name,
    teacherId: st.teacher.id,
    teacherName: st.teacher.name,
  }));

  // Count hadir today
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [presentToday, allAttendance, recentActivities] = await Promise.all([
    prisma.attendance.count({
      where: {
        student: { classId: class_.id },
        date: { gte: today },
        status: 'HADIR',
      }
    }),
    prisma.attendance.findMany({
      where: {
        student: { classId: class_.id }
      }
    }),
    getRecentActivities(class_.id),
  ]);

  const attendanceRate = allAttendance.length > 0
    ? Math.round((allAttendance.filter((a) => a.status === 'HADIR').length / allAttendance.length) * 100)
    : 0;

  return {
    className: class_.name,
    totalStudents: class_._count.students,
    totalSubjects: subjects.length,
    presentToday,
    attendanceRate,
    recentActivities,
    subjectTeachers: subjects,
  };
}

export async function GET(request: NextRequest) {
  try {
    const waliKelas = await requireWaliKelasAccess(request);
    if (!waliKelas) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const stats = await getWaliKelasStats(waliKelas.id);

    return NextResponse.json({ data: stats });
  } catch (error) {
    serverError('Dashboard error:', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
