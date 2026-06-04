import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTeacherOnly } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

async function requireTeacherAccess(request: NextRequest) {
  return requireTeacherOnly(request);
}

async function getTeacherClasses(teacherId: string) {
  const classTeachers = await prisma.classTeacher.findMany({
    where: { teacherId },
    include: { class: true },
    orderBy: { class: { name: 'asc' } }
  });

  return classTeachers.map(ct => ({
    id: ct.class.id,
    name: ct.class.name
  }));
}

export async function GET(request: NextRequest) {
  try {
    const teacher = await requireTeacherAccess(request);
    if (!teacher) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const classes = await getTeacherClasses(teacher.id);

    return NextResponse.json({ data: classes });
  } catch (error) {
    serverError('Teacher classes error:', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
