import { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { requireEditableClassByPeriod } from '@/lib/auth/class-access';
import { requireMenuAccess } from '@/lib/auth/verify-access';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { serverError } from '@/lib/server-log';

async function requireStudentManagement(req: NextRequest) {
  return requireMenuAccess(req, '/admin/students', ['ADMIN', 'PRINCIPAL']);
}

/**
 * GET /api/admin/students
 * Get all students with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireStudentManagement(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const classId = searchParams.get('classId') || '';
    const semesterId = searchParams.get('semesterId') || '';
    const schoolYearId = searchParams.get('schoolYearId') || '';

    const skip = (page - 1) * limit;

    const where: Prisma.StudentWhereInput = {};

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

    const classFilter: Prisma.ClassWhereInput = {};

    if (semesterId) {
      classFilter.semesterId = semesterId;
    }

    if (schoolYearId) {
      classFilter.schoolYearId = schoolYearId;
    }

    if (Object.keys(classFilter).length > 0) {
      where.class = classFilter;
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
    serverError('Error fetching students:', error);
    return errorResponse('Failed to fetch students', 500);
  }
}

/**
 * POST /api/admin/students
 * Create a new student
 */
export async function POST(request: NextRequest) {
  let studentData: { studentNo?: string } = {};
  
  try {
    const user = await requireStudentManagement(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    studentData = body; // Save for error logging
    const { name, studentNo, nourut, email, phone, address, birthDate, classId, parentPhoneNo } = body;

    if (!name || !studentNo || !classId) {
      return errorResponse('Name, student number, and class are required', 400);
    }

    const writableClass = await requireEditableClassByPeriod(classId);
    if (!writableClass.ok) {
      return errorResponse('Kelas semester lampau hanya dapat dibaca', 403);
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

    // Log activity
    await logActivity({
      userId: user.id,
      action: 'CREATE',
      resourceType: 'Student',
      resourceId: student.id,
      resourceName: `${student.name} (${student.studentNo})`,
      description: `Created student: ${student.name} with student number ${student.studentNo}`,
      newValue: {
        name: student.name,
        studentNo: student.studentNo,
        classId: student.classId,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
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
    serverError('Error creating student:', error);
    
    // Log failed student creation
    const user = await requireStudentManagement(request);
    if (user) {
      await logActivity({
        userId: user.id,
        action: 'CREATE',
        resourceType: 'Student',
        description: `Failed to create student`,
        newValue: { studentNo: studentData.studentNo || 'unknown' },
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    
    return errorResponse('Failed to create student', 500);
  }
}
