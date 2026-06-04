import { AssessmentType, Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { requireTeacherWaliAdminPrincipal } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

const gradeSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  // competencyId: z.union([
  //   z.string().min(1),
  //   z.literal('')
  // ]), // Allow empty string or valid ID
  competencyId: z.any().optional(), // Allow any competencyId value
  subjectId: z.string().optional(), // Allow optional subjectId
  score: z
    .union([z.string(), z.number()])
    .transform((val) => parseFloat(String(val)))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 10, {
      message: 'Score must be a number between 1 and 10',
    }),
  assessmentType: z.enum([
    'UTS_1',
    'UAS_1',
    'UTS_2',
    'UAS_2',
    'FINAL_EXAM_1',
    'FINAL_EXAM_2',
  ]),
  notes: z.string().optional(),
});

async function requireGradeAccess(req: NextRequest) {
  return requireTeacherWaliAdminPrincipal(req);
}

/**
 * GET /api/teacher/grades
 * Get grades for the current teacher/wali-kelas with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireGradeAccess(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const pageParam = parseInt(searchParams.get('page') || '1');
    const page = isNaN(pageParam) ? 1 : pageParam;
    const limitParam = parseInt(searchParams.get('limit') || '10');
    const limit = isNaN(limitParam) ? 10 : limitParam;
    const search = searchParams.get('search') || '';
    const classId = searchParams.get('classId') || '';
    const subjectId = searchParams.get('subjectId') || '';
    const assessmentType = searchParams.get('assessmentType') || '';
    const studentId = searchParams.get('studentId') || '';

    const skip = Math.max(0, (page - 1) * limit);

    // Build where clause
    const whereClause: Prisma.GradeWhereInput = {};

    // Teachers can only see their own grades; wali-kelas can see grades for their classes; admin can see all
    if (user.role === 'ADMIN') {
      // Admin sees all grades, no restriction — just apply filters below
    } else if (user.role === 'TEACHER') {
      // For teacher, filter by their own grades
      // Also verify they're teaching in the requested class if classId is provided
      whereClause.teacher = {
        id: user.id,
      };
    } else if (user.role === 'WALI_KELAS') {
      if (!classId) {
        return errorResponse('classId is required for wali-kelas', 400);
      }
      
      // Wali-kelas can see grades where:
      // 1. They are the waliKelasId of the class, OR
      // 2. They teach in the class (ClassTeacher relationship)
      const orConditions: Prisma.GradeWhereInput[] = [
        {
          student: {
            class: {
              id: classId,
              waliKelasId: user.id,
            },
          },
        },
      ];

      // Check if wali-kelas also teaches in this class
      const classTeacher = await prisma.classTeacher.findFirst({
        where: {
          teacherId: user.id,
          classId: classId,
        },
      });

      // If they teach in the class, allow them to see their own grades in this class
      if (classTeacher) {
        orConditions.push({
          teacher: {
            id: user.id,
          },
          student: {
            classId: classId,
          },
        });
      }

      whereClause.OR = orConditions;
    }

    // Apply additional filters
    if (search) {
      if (whereClause.OR) {
        // Preserve existing OR (authorization) and add search as AND condition
        whereClause.AND = [
          { OR: whereClause.OR },
          {
            OR: [
              { student: { name: { contains: search, mode: 'insensitive' } } },
              { competency: { name: { contains: search, mode: 'insensitive' } } },
              { competency: { subject: { name: { contains: search, mode: 'insensitive' } } } },
            ],
          },
        ];
        delete whereClause.OR;
      } else {
        whereClause.OR = [
          { student: { name: { contains: search, mode: 'insensitive' } } },
          { competency: { name: { contains: search, mode: 'insensitive' } } },
          { competency: { subject: { name: { contains: search, mode: 'insensitive' } } } },
        ];
      }
    }

    // Apply studentId filter for all roles
    if (studentId) {
      whereClause.studentId = studentId;
    }

    // Apply classId filter - data harus dari class yang dipilih
    if (classId) {
      if (!whereClause.AND) {
        whereClause.AND = [];
      } else if (!Array.isArray(whereClause.AND)) {
        whereClause.AND = [whereClause.AND];
      }
      
      whereClause.AND.push({
        classId: classId
      });
    }

    if (subjectId) {
      // Filter by subject through competency.subjectId
      if (!whereClause.AND) {
        whereClause.AND = [];
      } else if (!Array.isArray(whereClause.AND)) {
        whereClause.AND = [whereClause.AND];
      }
      
      whereClause.AND.push({
        subjectId: subjectId
      });
    }

    if (
      assessmentType &&
      Object.values(AssessmentType).includes(assessmentType as AssessmentType)
    ) {
      whereClause.assessmentType = assessmentType as AssessmentType;
    }


    const grades = await prisma.grade.findMany({
      where: whereClause,
      include: {
        student: {
          include: {
            class: true,
          },
        },
        competency: {
          include: {
            subject: true,
          },
        },
        subject: true,
        teacher: true,
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.grade.count({ where: whereClause });


    return paginatedResponse(
      grades.map((g) => ({
        id: g.id,
        studentId: g.studentId,
        studentName: g.student.name,
        studentNo: g.student.studentNo || '-',
        studentNisn: g.student.studentNo || '-',
        studentNourut: g.student.nourut,
        className: g.student.class?.name || '-',
        competencyId: g.competencyId || '',
        competencyName: g.competency?.name || '',
        subjectName: g.competency?.subject?.name || g.subject?.name || '',
        score: g.score,
        assessmentType: g.assessmentType,
        teacherId: g.teacherId,
        teacherName: g.teacher?.name || '-',
        notes: g.notes || '',
        date: g.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      })),
      total,
      page,
      limit
    );
  } catch (error) {
    serverError('Get grades error:', error);
    return errorResponse('Failed to fetch grades', 500);
  }
}

/**
 * POST /api/teacher/grades
 * Create a new grade
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireGradeAccess(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Allow ADMIN, PRINCIPAL, TEACHER, and WALI_KELAS
    if (user.role !== 'ADMIN' && user.role !== 'PRINCIPAL' && user.role !== 'TEACHER' && user.role !== 'WALI_KELAS') {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const validatedData = gradeSchema.parse(body);

    // Verify that student exists in a class taught by/assigned to this user
    // Admin and Principal can create grades for any student
    let classTeacher;
    if (user.role === 'ADMIN' || user.role === 'PRINCIPAL') {
      // Admin/Principal can create grades for any student, no verification needed
    } else if (user.role === 'TEACHER') {
      classTeacher = await prisma.classTeacher.findFirst({
        where: {
          teacherId: user.id,
          class: {
            students: {
              some: {
                id: validatedData.studentId,
              },
            },
          },
        },
      });
    } else if (user.role === 'WALI_KELAS') {
      // For wali-kelas, verify student is in their class OR they teach a subject in that class
      const student = await prisma.student.findUnique({
        where: { id: validatedData.studentId },
        include: { class: true },
      });

      if (!student) {
        return errorResponse('Student not found', 400);
      }

      // Check: is WALI_KELAS the wali kelas of this student's class?
      const isWaliKelas = student.class?.waliKelasId === user.id;
      
      // Check: does WALI_KELAS teach any subject in this student's class?
      let isTeachingInClass = false;
      if (!isWaliKelas) {
        const teachesInClass = await prisma.classTeacher.count({
          where: {
            teacherId: user.id,
            classId: student.classId,
          },
        });
        isTeachingInClass = teachesInClass > 0;
      }

      if (!isWaliKelas && !isTeachingInClass) {
        return errorResponse('Student not found in your class', 400);
      }
    }

    // Verify student ownership based on role
    if (user.role === 'TEACHER' && !classTeacher) {
      return errorResponse('Student not found in your classes', 400);
    }

    // Verify that competency exists (if provided)
    if (validatedData.competencyId && validatedData.competencyId !== '') {
      const competency = await prisma.competency.findUnique({
        where: { id: validatedData.competencyId },
        include: {
          subject: true,
        },
      });

      if (!competency) {
        return errorResponse('Competency not found', 404);
      }

      // If subjectId is provided, verify that competency belongs to that subject
      if (validatedData.subjectId && competency.subjectId !== validatedData.subjectId) {
        return errorResponse('Competency does not belong to the specified subject', 400);
      }
    } else {
      // If no competency is provided but subjectId is, that's OK - it's optional
      // No validation needed
    }

    // Check if grade already exists with same combination
    // Only check if competencyId is provided
    let existingGrade = null;
    if (validatedData.competencyId && validatedData.competencyId !== '') {
      existingGrade = await prisma.grade.findFirst({
        where: {
          studentId: validatedData.studentId,
          competencyId: validatedData.competencyId,
          teacherId: user.id,
          assessmentType: validatedData.assessmentType,
          subjectId: validatedData.subjectId, // IMPORTANT: Filter by subjectId to prevent overwriting other subjects
        },
      });
    }

    // Get student and their class/level information
    const student = await prisma.student.findUnique({
      where: { id: validatedData.studentId },
      include: { 
        class: {
          include: {
            level: true
          }
        } 
      },
    });

    if (!student || !student.class) {
      return errorResponse('Student or student class not found', 400);
    }

    const levelId = student.class.level?.id || '';

    let grade;
    if (existingGrade) {
      // Update existing grade
      grade = await prisma.grade.update({
        where: { id: existingGrade.id },
        data: {
          score: String(validatedData.score),
          notes: validatedData.notes,
          subjectId: validatedData.subjectId, // Ensure subjectId is updated
        },
        include: {
          student: true,
          competency: {
            include: {
              subject: true,
            },
          },
          subject: true,
        },
      });
    } else {
      // Create new grade
      grade = await prisma.grade.create({
        data: {
          studentId: validatedData.studentId,
          classId: student.classId, // Add classId from student's class
          competencyId: validatedData.competencyId && validatedData.competencyId !== '' ? validatedData.competencyId : null,
          subjectId: validatedData.subjectId,
          score: String(validatedData.score),
          assessmentType: validatedData.assessmentType,
          notes: validatedData.notes,
          teacherId: user.id,
          levelId: levelId,
          scoringType: 'NUMERIC_0_100',
        },
        include: {
          student: true,
          competency: {
            include: {
              subject: true,
            },
          },
          subject: true,
        },
      });
    }


    // Log activity
    await logActivity({
      userId: user.id,
      action: existingGrade ? 'UPDATE' : 'CREATE',
      resourceType: 'Grade',
      resourceId: grade.id,
      resourceName: `Grade for ${grade.student.name} - ${grade.competency?.name || 'No Competency'}`,
      description: existingGrade 
        ? `Updated grade for ${grade.student.name}: ${grade.score}` 
        : `Created grade for ${grade.student.name}: ${grade.score}`,
      newValue: {
        studentId: grade.studentId,
        competencyId: grade.competencyId,
        score: grade.score,
        assessmentType: grade.assessmentType,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse({
      id: grade.id,
      studentId: grade.studentId,
      studentName: grade.student.name,
      competencyId: grade.competencyId || '',
      competencyName: grade.competency?.name || '',
      subjectName: grade.competency?.subject?.name || grade.subject?.name || '',
      score: grade.score,
      assessmentType: grade.assessmentType,
      notes: grade.notes || '',
      message: existingGrade ? 'Nilai berhasil diperbarui' : 'Nilai berhasil ditambahkan',
      date: grade.createdAt?.toISOString().split('T')[0],
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      serverError('Validation error details:', error.issues);
      const fieldErrors = error.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return errorResponse('Validation error', 400, fieldErrors);
    }
    serverError('Create grade error:', error);

    // Log failed grade creation
    const user = await requireGradeAccess(request);
    if (user) {
      await logActivity({
        userId: user.id,
        action: 'CREATE',
        resourceType: 'Grade',
        description: 'Failed to create grade',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return errorResponse('Failed to create grade', 500);
  }
}
