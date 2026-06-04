import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/auth/middleware';
import { TokenPayload } from '@/types';
import { serverError } from '@/lib/server-log';

// GET: Fetch students for teacher
export async function GET(req: NextRequest) {
  return withAuth(handleGET)(req);
}

async function handleGET(
  req: NextRequest,
  user: TokenPayload
): Promise<NextResponse> {
  try {
    const teacher = await prisma.user.findUnique({
      where: { id: user.userId },
    });

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

    const whereClause: {
      classId: string | { in: string[] };
      OR?: Array<{
        name?: { contains: string; mode: 'insensitive' };
        studentNo?: { contains: string; mode: 'insensitive' };
        email?: { contains: string; mode: 'insensitive' };
      }>;
    } = {
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
          },
        },
      },
      skip,
      take: limit,
      orderBy: [
        { nourut: { sort: 'asc', nulls: 'last' } },
        { name: 'asc' },
      ],
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
    serverError('Error fetching students:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create student
export async function POST(req: NextRequest) {
  return withAuth(handlePOST)(req);
}

async function handlePOST(
  req: NextRequest,
  user: TokenPayload
): Promise<NextResponse> {
  try {
    const teacher = await prisma.user.findUnique({
      where: { id: user.userId },
    });

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
    serverError('Error creating student:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
