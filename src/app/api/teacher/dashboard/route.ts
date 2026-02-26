import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';

interface DashboardResponse {
  totalClasses: number;
  totalStudents: number;
  pendingGrades: number;
  attendanceToday: number;
  recentActivities: Activity[];
}

interface Activity {
  id: string;
  type: 'grade' | 'attendance' | 'competency';
  title: string;
  description: string;
  timestamp: string;
  activityType: 'success' | 'info' | 'warning';
}

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

  if (teacher && teacher.role === 'TEACHER') {
    return teacher;
  }
  return null;
}

async function getRecentActivities(teacherId: string, classIds: string[]): Promise<Activity[]> {
  const activities: Activity[] = [];

  // Get recent grades (last 3)
  const recentGrades = await prisma.grade.findMany({
    where: {
      teacherId: teacherId,
    },
    include: {
      student: {
        include: {
          class: true,
        },
      },
      competency: {
        include: {
          subject: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

  recentGrades.forEach((grade) => {
    activities.push({
      id: grade.id,
      type: 'grade',
      title: 'Nilai Input Berhasil',
      description: `Nilai ${grade.score} untuk siswa ${grade.student.name} di kompetensi ${grade.competency.subject.name}`,
      timestamp: new Date(grade.createdAt).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
      activityType: 'success',
    });
  });

  // Get recent attendance records (last 3)
  const recentAttendance = await prisma.attendance.findMany({
    where: {
      student: {
        classId: { in: classIds },
      },
    },
    include: {
      student: {
        include: {
          class: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

  recentAttendance.forEach((att) => {
    const statusLabel = att.status === 'HADIR' ? 'Hadir' : 
                        att.status === 'SAKIT' ? 'Sakit' : 
                        att.status === 'IZIN' ? 'Izin' : 'Alpa';
    
    activities.push({
      id: att.id,
      type: 'attendance',
      title: 'Absensi Tercatat',
      description: `${att.student.name} (${att.student.class.name}) - ${statusLabel}`,
      timestamp: new Date(att.date).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
      activityType: att.status === 'ALFA' ? 'warning' : 'info',
    });
  });

  // Get recent competency updates (last 2)
  const recentCompetencies = await prisma.competency.findMany({
    where: {
      subject: {
        classSubjects: {
          some: {
            class: {
              id: { in: classIds },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 2,
  });

  recentCompetencies.forEach((comp) => {
    activities.push({
      id: comp.id,
      type: 'competency',
      title: 'Kompetensi Diperbarui',
      description: `Kompetensi ${comp.code} - ${comp.name} telah diperbarui`,
      timestamp: new Date(comp.updatedAt).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
      activityType: 'info',
    });
  });

  // Sort by timestamp (most recent first) and return top 5
  return activities
    .sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    })
    .slice(0, 5);
}

export async function GET(req: NextRequest) {
  try {
    const teacher = await getTeacher(req);
    if (!teacher) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get unique classes where teacher teaches
    const teacherClasses = await prisma.classTeacher.findMany({
      where: { teacherId: teacher.id },
      distinct: ['classId'],
      select: { classId: true },
    });

    const classIds = teacherClasses.map((ct) => ct.classId);
    const totalClasses = classIds.length;

    // If teacher has no classes, return empty dashboard
    if (classIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalClasses: 0,
          totalStudents: 0,
          pendingGrades: 0,
          attendanceToday: 0,
          recentActivities: [],
        },
      });
    }

    // Get total students in those classes
    const totalStudents = await prisma.student.count({
      where: {
        classId: { in: classIds },
      },
    });

    // Get pending grades - count grades that were recently entered but might need review/completion
    const pendingGrades = await prisma.grade.count({
      where: {
        teacherId: teacher.id,
        student: {
          classId: { in: classIds },
        },
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
    });

    // Get attendance today (count of students with attendance recorded today)
    const today = new Date();
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const endOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));

    const attendanceToday = await prisma.attendance.count({
      where: {
        student: {
          classId: { in: classIds },
        },
        date: {
          gte: startOfDay,
          lt: endOfDay,
        },
        status: 'HADIR',
      },
    });

    // Get total attendance capacity for today
    const totalCapacityToday = totalStudents;
    const attendanceTodayPercentage = totalCapacityToday > 0 
      ? Math.round((attendanceToday / totalCapacityToday) * 100)
      : 0;

    // Get recent activities
    const recentActivities = await getRecentActivities(teacher.id, classIds);

    return NextResponse.json({
      success: true,
      data: {
        totalClasses,
        totalStudents,
        pendingGrades,
        attendanceToday: attendanceTodayPercentage,
        recentActivities,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
