import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { z } from 'zod';

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
  
  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL' || user.role === 'WALI_KELAS')) {
    return user;
  }
  return null;
}

const studentSchema = z.object({
  studentNo: z.string().min(1, 'Nomor siswa harus diisi'),
  name: z.string().min(1, 'Nama harus diisi'),
  email: z.string().email('Email tidak valid').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  birthDate: z.string().optional(),
  parentPhoneNo: z.string().optional(),
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
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

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

    const where: any = {
      classId: id,
    };

    if (search) {
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
          email: true,
          phone: true,
          address: true,
          birthDate: true,
          parentPhoneNo: true,
          classId: true,
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.student.count({
        where,
      }),
    ]);

    return paginatedResponse(students, total, page, limit);
  } catch (error) {
    console.error('Get class students error:', error);
    return errorResponse('Failed to fetch students', 500);
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
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
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

    const { studentNo, name, email, phone, address, birthDate, parentPhoneNo } = validation.data;

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
          email: email || null,
          phone: phone || null,
          address: address || null,
          birthDate: birthDate ? new Date(birthDate) : null,
          parentPhoneNo: parentPhoneNo || null,
        },
        select: {
          id: true,
          studentNo: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          birthDate: true,
          parentPhoneNo: true,
          classId: true,
        },
      });
      return successResponse(updated, 'Student updated successfully');
    }

    // Create new student
    const newStudent = await prisma.student.create({
      data: {
        classId: id,
        studentNo,
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        parentPhoneNo: parentPhoneNo || null,
      },
      select: {
        id: true,
        studentNo: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        birthDate: true,
        parentPhoneNo: true,
        classId: true,
      },
    });

    return successResponse(newStudent, 'Student created successfully', 201);
  } catch (error: any) {
    console.error('Create student error:', error);
    if (error.code === 'P2002') {
      return errorResponse('Siswa dengan nomor yang sama sudah ada di kelas ini', 400);
    }
    return errorResponse('Failed to create/update student', 500);
  }
}

