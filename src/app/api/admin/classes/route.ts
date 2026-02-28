import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
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
  
  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL' || user.role === 'WALI_KELAS')) {
    return user;
  }
  return null;
}

const classSchema = z.object({
  levelId: z.string().min(1, 'Level ID harus diisi'),
  schoolYearId: z.string().min(1, 'School Year ID harus diisi'),
  semesterId: z.string().min(1, 'Semester ID harus diisi'),
  name: z.string().min(1, 'Nama kelas harus diisi'),
  capacity: z.number().min(1, 'Kapasitas harus lebih dari 0').optional(),
  waliKelasId: z.string().optional(),
  teachers: z.array(z.object({
    teacherId: z.string(),
    subjectId: z.string(),
  })).optional(),
});

/**
 * GET /api/admin/classes
 * Get all classes with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return errorResponse('Token tidak valid atau expired', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const levelId = searchParams.get('levelId');
    const schoolYearId = searchParams.get('schoolYearId');
    const semesterId = searchParams.get('semesterId');
    const waliKelasId = searchParams.get('waliKelasId');
    const search = searchParams.get('search') || '';
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Validation: Check pagination parameters
    if (page < 1) {
      return errorResponse('Nomor halaman tidak valid', 400);
    }
    if (limit < 1 || limit > 1000) {
      return errorResponse('Limit harus antara 1-1000', 400);
    }

    const skip = (page - 1) * limit;

    // Build where clause with validation
    const where: any = {};
    
    // By default, only show active classes unless explicitly requested otherwise
    if (!includeInactive) {
      where.isActive = true;
    }
    
    if (levelId && levelId.trim() !== '') {
      where.levelId = levelId;
    }
    if (schoolYearId && schoolYearId.trim() !== '') {
      where.schoolYearId = schoolYearId;
    }
    if (semesterId && semesterId.trim() !== '') {
      where.semesterId = semesterId;
    }
    
    // For WALI_KELAS, only show their own class
    if (admin.role === 'WALI_KELAS') {
      where.waliKelasId = admin.id;
    } else if (waliKelasId && waliKelasId.trim() !== '') {
      // For ADMIN/PRINCIPAL, can filter by waliKelasId
      where.waliKelasId = waliKelasId;
    }
    
    if (search && search.trim() !== '') {
      where.name = { contains: search, mode: 'insensitive' as const };
    }

    const [classes, total] = await Promise.all([
      prisma.class.findMany({
        where,
        include: {
          level: { select: { id: true, name: true, code: true } },
          schoolYear: { select: { id: true, year: true } },
          semester: { select: { id: true, number: true } },
          waliKelas: { select: { id: true, name: true, email: true } },
          teachers: {
            include: {
              teacher: { select: { id: true, name: true, email: true } },
              subject: { select: { id: true, name: true, code: true } },
            },
          },
          _count: {
            select: { students: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.class.count({ where }),
    ]);

    return paginatedResponse(classes, total, page, limit);
  } catch (error) {
    console.error('Get classes error:', error);
    return errorResponse('Gagal memuat daftar kelas', 500);
  }
}

/**
 * POST /api/admin/classes
 * Create a new class
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    // Only ADMIN and PRINCIPAL can create classes
    if (admin.role !== 'ADMIN' && admin.role !== 'PRINCIPAL') {
      return errorResponse('Forbidden', 403);
    }

    const body = await request.json();
    const validatedData = classSchema.parse(body);

    // Check if level exists
    const level = await prisma.level.findUnique({
      where: { id: validatedData.levelId },
    });
    if (!level) {
      return errorResponse('Level tidak ditemukan', 404);
    }

    // Check if school year exists
    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: validatedData.schoolYearId },
    });
    if (!schoolYear) {
      return errorResponse('Tahun akademik tidak ditemukan', 404);
    }

    // Check if semester exists
    const semester = await prisma.semester.findUnique({
      where: { id: validatedData.semesterId },
    });
    if (!semester) {
      return errorResponse('Semester tidak ditemukan', 404);
    }

    // Create class
    const newClass = await prisma.class.create({
      data: {
        levelId: validatedData.levelId,
        schoolYearId: validatedData.schoolYearId,
        semesterId: validatedData.semesterId,
        name: validatedData.name,
        capacity: validatedData.capacity || 40,
        waliKelasId: validatedData.waliKelasId || null,
      },
      include: {
        level: true,
        schoolYear: true,
        semester: true,
        waliKelas: { select: { id: true, name: true, email: true } },
        teachers: {
          include: {
            teacher: true,
            subject: true,
          },
        },
        _count: { select: { students: true } },
      },
    });

    // Add teachers if provided
    if (validatedData.teachers && validatedData.teachers.length > 0) {
      for (const teacherData of validatedData.teachers) {
        await prisma.classTeacher.create({
          data: {
            classId: newClass.id,
            teacherId: teacherData.teacherId,
            subjectId: teacherData.subjectId,
          },
        });
      }
    }

    return successResponse(newClass, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    console.error('Create class error:', error);
    return errorResponse('Failed to create class', 500);
  }
}
