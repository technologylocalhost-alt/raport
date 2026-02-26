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
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const teacher = await getTeacher(token);
    const classes = await getTeacherClasses(teacher.id);

    return NextResponse.json({ data: classes });
  } catch (error) {
    console.error('Teacher classes error:', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
