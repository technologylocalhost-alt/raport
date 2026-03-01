import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { z } from 'zod';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';

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
  
  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL' || user.role === 'WALI_KELAS' || user.role === 'TEACHER')) {
    return user;
  }
  return null;
}

const studentSchema = z.object({
  studentNo: z.string().min(1, 'Nomor siswa harus diisi'),
  name: z.string().min(1, 'Nama harus diisi'),
  nourut: z.union([z.string(), z.number()]).optional().transform(val => {
    if (val === undefined || val === null || val === '') return null;
    const num = typeof val === 'string' ? parseInt(val) : val;
    return isNaN(num) ? null : num;
  }),
  email: z.string().email('Email tidak valid').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  birthDate: z.string().optional(),
  parentPhoneNo: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional().default('MALE'),
});

/**
 * GET /api/admin/classes/[id]/students
 * Get all students in a specific class
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return errorResponse('Token tidak valid atau expired', 401);
    }

    const { id } = await params;

    // Validation: Check id format
    if (!id || id.trim() === '') {
      return errorResponse('ID Kelas tidak valid', 400);
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';

    // Validation: Check pagination parameters
    if (page < 1) {
      return errorResponse('Nomor halaman tidak valid', 400);
    }
    if (limit < 1 || limit > 1000) {
      return errorResponse('Limit harus antara 1-1000', 400);
    }

    const skip = (page - 1) * limit;

    // Verify the class exists
    const classData = await prisma.class.findUnique({
      where: { id },
      select: { id: true, waliKelasId: true },
    });

    if (!classData) {
      return errorResponse('Kelas tidak ditemukan', 404);
    }

    // Authorization check
    if (user.role === 'WALI_KELAS') {
      // WALI_KELAS can access: their own class OR classes where they teach subjects
      const isWaliKelas = classData.waliKelasId === user.id;
      
      if (!isWaliKelas) {
        // Check if WALI_KELAS also teaches in this class
        const teacherSubjects = await prisma.classTeacher.count({
          where: {
            classId: id,
            teacherId: user.id,
          },
        });
        
        if (teacherSubjects === 0) {
          return errorResponse('Anda tidak memiliki akses ke kelas ini', 403);
        }
      }
    } else if (user.role === 'TEACHER') {
      // TEACHER can access classes where they teach subjects
      const teacherSubjects = await prisma.classTeacher.count({
        where: {
          classId: id,
          teacherId: user.id,
        },
      });
      if (teacherSubjects === 0) {
        return errorResponse('Anda tidak memiliki akses ke kelas ini', 403);
      }
    }
    // ADMIN and PRINCIPAL have access to all classes (no additional check needed)

    const where: any = {
      classId: id,
    };

    if (search && search.trim() !== '') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { studentNo: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        select: {
          id: true,
          studentNo: true,
          name: true,
          nourut: true,
          email: true,
          phone: true,
          gender: true,
          address: true,
          birthDate: true,
          parentPhoneNo: true,
          classId: true,
          nilaiApproves: {
            where: {
              nomorRaport: {
                not: null,
              },
            },
            select: {
              nomorRaport: true,
            },
            take: 1,
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
        skip,
        take: limit,
        orderBy: [
          { nourut: { sort: 'asc', nulls: 'last' } },
          { name: 'asc' },
        ],
      }),
      prisma.student.count({
        where,
      }),
    ]);

    // Transform the data to include raportNo at the top level
    const studentsWithRaportNo = students.map(student => ({
      id: student.id,
      studentNo: student.studentNo,
      name: student.name,
      nourut: student.nourut,
      email: student.email,
      phone: student.phone,
      address: student.address,
      birthDate: student.birthDate,
      parentPhoneNo: student.parentPhoneNo,
      classId: student.classId,
      gender: student.gender,
      raportNo: student.nilaiApproves[0]?.nomorRaport || null,
    }));

    return paginatedResponse(studentsWithRaportNo, total, page, limit);
  } catch (error) {
    console.error('Get class students error:', error);
    return errorResponse('Gagal memuat data siswa', 500);
  }
}

/**
 * POST /api/admin/classes/[id]/students
 * Add or update a student in a specific class
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await verifyAdmin(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Only ADMIN, PRINCIPAL, and WALI_KELAS can add students
    if (user.role === 'TEACHER') {
      return errorResponse('Unauthorized', 403);
    }

    const { id } = await params;

    // Verify the class exists
    const classData = await prisma.class.findUnique({
      where: { id },
      select: { id: true, waliKelasId: true },
    });

    if (!classData) {
      return errorResponse('Class not found', 404);
    }

    // If user is WALI_KELAS, verify they own this class
    if (user.role === 'WALI_KELAS' && classData.waliKelasId !== user.id) {
      return errorResponse('Unauthorized', 403);
    }

    const body = await request.json();
    const validation = studentSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse('Invalid input', 400);
    }

    const { studentNo, name, nourut, email, phone, address, birthDate, parentPhoneNo, gender } = validation.data;

    // Check if student with this studentNo already exists in this class
    const existingStudent = await prisma.student.findUnique({
      where: {
        classId_studentNo: {
          classId: id,
          studentNo,
        },
      },
    });

    if (existingStudent) {
      // Update existing student
      const updated = await prisma.student.update({
        where: { id: existingStudent.id },
        data: {
          name,
          nourut: nourut || null,
          email: email || null,
          phone: phone || null,
          address: address || null,
          birthDate: birthDate ? new Date(birthDate) : null,
          parentPhoneNo: parentPhoneNo || null,
          gender: gender || 'MALE',
        },
        select: {
          id: true,
          studentNo: true,
          name: true,
          nourut: true,
          email: true,
          phone: true,
          gender: true,
          address: true,
          birthDate: true,
          parentPhoneNo: true,
          classId: true,
        },
      });

      await logActivity({
        userId: user.id,
        action: 'UPDATE',
        resourceType: 'Student',
        resourceId: updated.id,
        resourceName: updated.name,
        description: `Updated student ${updated.name} in class`,
        newValue: validation.data,
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'SUCCESS',
      });

      return successResponse(updated, 'Student updated successfully');
    }

    // Create new student
    const newStudent = await prisma.student.create({
      data: {
        classId: id,
        studentNo,
        name,
        nourut: nourut || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        parentPhoneNo: parentPhoneNo || null,
        gender: gender || 'MALE',
      },
      select: {
        id: true,
        studentNo: true,
        name: true,
        nourut: true,
        email: true,
        phone: true,
        gender: true,
        address: true,
        birthDate: true,
        parentPhoneNo: true,
        classId: true,
      },
    });

    await logActivity({
      userId: user.id,
      action: 'CREATE',
      resourceType: 'Student',
      resourceId: newStudent.id,
      resourceName: newStudent.name,
      description: `Created new student ${newStudent.name}`,
      newValue: validation.data,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(newStudent, 'Student created successfully', 201);
  } catch (error: any) {
    console.error('Create student error:', error);
    if (user) {
      await logActivity({
        userId: user.id,
        action: 'CREATE',
        resourceType: 'Student',
        resourceId: '',
        description: `Failed to create/update student`,
        errorMessage: error?.message || 'Unknown error',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
      });
    }
    if (error.code === 'P2002') {
      return errorResponse('Siswa dengan nomor yang sama sudah ada di kelas ini', 400);
    }
    return errorResponse('Failed to create/update student', 500);
  }
}

