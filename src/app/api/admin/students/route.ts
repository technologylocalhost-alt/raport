import { NextRequest } from 'next/server';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL')) {
    return user;
  }
  return null;
}

/**
 * GET /api/admin/students
 * Get all students with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const classId = searchParams.get('classId') || '';
    const semesterId = searchParams.get('semesterId') || '';

    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { studentNo: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (classId) {
      where.classId = classId;
    }

    if (semesterId) {
      where.class = {
        semesterId: semesterId,
      };
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
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
        orderBy: [
          { class: { name: 'asc' } },
          { nourut: { sort: 'asc', nulls: 'last' } },
          { name: 'asc' },
        ],
      }),
      prisma.student.count({ where }),
    ]);

    const formattedData = students.map((student) => ({
      id: student.id,
      name: student.name,
      studentNo: student.studentNo,
      nourut: student.nourut,
      email: student.email,
      phone: student.phone,
      address: student.address,
      birthDate: student.birthDate,
      className: student.class?.name || '-',
      levelName: student.class?.level?.name || '-',
      schoolYear: student.class?.schoolYear?.year || '-',
      classId: student.classId,
    }));

    return paginatedResponse(formattedData, total, page, limit);
  } catch (error) {
    console.error('Error fetching students:', error);
    return errorResponse('Failed to fetch students', 500);
  }
}

/**
 * POST /api/admin/students
 * Create a new student
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const { name, studentNo, nourut, email, phone, address, birthDate, classId, parentPhoneNo } = body;

    if (!name || !studentNo || !classId) {
      return errorResponse('Name, student number, and class are required', 400);
    }

    // Check if student number already exists
    const existingStudent = await prisma.student.findFirst({
      where: { studentNo },
    });

    if (existingStudent) {
      return errorResponse('Student number already exists', 409);
    }

    const student = await prisma.student.create({
      data: {
        name,
        studentNo,
        nourut: nourut || null,
        email,
        phone,
        address,
        birthDate: birthDate ? new Date(birthDate) : null,
        classId,
        parentPhoneNo,
      },
      include: {
        class: {
          include: {
            level: true,
            schoolYear: true,
          },
        },
      },
    });

    return successResponse({
      id: student.id,
      name: student.name,
      studentNo: student.studentNo,
      email: student.email,
      phone: student.phone,
      address: student.address,
      birthDate: student.birthDate,
      className: student.class?.name || '-',
      classId: student.classId,
    });
  } catch (error) {
    console.error('Error creating student:', error);
    return errorResponse('Failed to create student', 500);
  }
}
