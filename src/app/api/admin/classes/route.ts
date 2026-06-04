import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/access';
import { requireMenuAccess } from '@/lib/auth/verify-access';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { serverError } from '@/lib/server-log';

async function requireClassAccess(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;

  if (user.role === 'ADMIN' || user.role === 'PRINCIPAL') {
    return requireMenuAccess(req, '/admin/classes', ['ADMIN', 'PRINCIPAL']);
  }

  if (user.role === 'WALI_KELAS') {
    return requireMenuAccess(req, '/wali-kelas/classes', ['WALI_KELAS']);
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
    const admin = await requireClassAccess(request);
    if (!admin) {
      return errorResponse('Token tidak valid atau expired', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const levelId = searchParams.get('levelId');
    const schoolId = searchParams.get('schoolId');
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
    const where: Prisma.ClassWhereInput = {};
    const schoolYearWhere: Prisma.SchoolYearWhereInput = {};
    const levelWhere: Prisma.LevelWhereInput = {};
    
    // By default, only show active classes unless explicitly requested otherwise
    if (!includeInactive) {
      where.isActive = true;
      // For WALI_KELAS, allow viewing classes even if school year is inactive
      // They should still see all their assigned classes
      // For ADMIN/PRINCIPAL, only show active school years unless explicitly selecting a schoolYearId
      if (admin.role !== 'WALI_KELAS') {
        // Also filter by active school years - BUT only if not explicitly filtering by a specific schoolYearId
        // If user explicitly selects a schoolYearId (active or inactive), show classes from that year
        if (!schoolYearId || schoolYearId.trim() === '') {
          schoolYearWhere.isActive = true;
        }
      }
    }
    
    if (levelId && levelId.trim() !== '') {
      where.levelId = levelId;
    }
    if (schoolId && schoolId.trim() !== '') {
      where.schoolYear = {
        ...((where.schoolYear && typeof where.schoolYear === 'object') ? where.schoolYear as Record<string, unknown> : {}),
        schoolId,
      } as Prisma.SchoolYearWhereInput;
      where.level = {
        ...((where.level && typeof where.level === 'object') ? where.level as Record<string, unknown> : {}),
        schoolId,
      } as Prisma.LevelWhereInput;
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
    if (Object.keys(schoolYearWhere).length > 0) {
      where.schoolYear = schoolYearWhere;
    }
    if (Object.keys(levelWhere).length > 0) {
      where.level = levelWhere;
    }

    const [classes, total] = await Promise.all([
      prisma.class.findMany({
        where,
        include: {
          level: { select: { id: true, name: true, code: true } },
          schoolYear: { select: { id: true, year: true, isActive: true } },
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
    serverError('Get classes error:', error);
    return errorResponse('Gagal memuat daftar kelas', 500);
  }
}

/**
 * POST /api/admin/classes
 * Create a new class
 */
export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await requireClassAccess(request);
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

    // Log activity
    await logActivity({
      userId: admin.id,
      action: 'CREATE',
      resourceType: 'Class',
      resourceId: newClass.id,
      resourceName: newClass.name,
      description: `Created class: ${newClass.name} for level ${level.name}`,
      newValue: {
        name: newClass.name,
        levelId: newClass.levelId,
        schoolYearId: newClass.schoolYearId,
        semesterId: newClass.semesterId,
        capacity: newClass.capacity,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(newClass, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    serverError('Create class error:', error);
    
    // Log failed class creation
    if (admin) {
      await logActivity({
        userId: admin.id,
        action: 'CREATE',
        resourceType: 'Class',
        description: 'Failed to create class',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return errorResponse('Failed to create class', 500);
  }
}
