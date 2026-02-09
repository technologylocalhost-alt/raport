import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';

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
    const classId = searchParams.get('classId');

    const skip = (page - 1) * limit;

    // Get students from classes where teacher teaches
    const teacherClasses = await prisma.classTeacher.findMany({
      where: { teacherId: teacher.id },
      distinct: ['classId'],
      select: { classId: true },
    });

    const classIds = teacherClasses.map((ct) => ct.classId);

    const whereClause: any = {
      classId: { in: classIds },
    };

    if (classId) {
      whereClause.classId = classId;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { studentNo: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const students = await prisma.student.findMany({
      where: whereClause,
      include: {
        class: {
          include: {
            level: true,
            schoolYear: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { name: 'asc' },
    });

    const total = await prisma.student.count({ where: whereClause });

    return NextResponse.json({
      success: true,
      data: students.map((s) => ({
        id: s.id,
        name: s.name,
        nisn: s.studentNo,
        className: s.class.name,
        levelName: s.class.level.name,
        email: s.email,
        phone: s.phone,
        birthDate: s.birthDate?.toISOString().split('T')[0],
        address: s.address,
      })),
      page,
      limit,
      total,
    });
  } catch (error) {
    console.error('Error fetching students:', error);
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
    const { name, studentNo, classId, email, phone, birthDate, address } = body;

    if (!name || !studentNo || !classId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify teacher has access to this class
    const classTeacher = await prisma.classTeacher.findFirst({
      where: { classId, teacherId: teacher.id },
    });

    if (!classTeacher) {
      return NextResponse.json({ error: 'Not authorized to add students to this class' }, { status: 403 });
    }

    const student = await prisma.student.create({
      data: {
        name,
        studentNo,
        classId,
        email,
        phone,
        birthDate: birthDate ? new Date(birthDate) : null,
        address,
      },
      include: {
        class: {
          include: {
            level: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: student,
    });
  } catch (error) {
    console.error('Error creating student:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
