import { NextRequest } from 'next/server';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth/jwt';

const gradeSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  competencyId: z.string().min(1, 'Competency ID is required'),
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

async function getUser(req: NextRequest) {
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

  if (user && (user.role === 'TEACHER' || user.role === 'WALI_KELAS')) {
    return user;
  }
  return null;
}

/**
 * GET /api/teacher/grades
 * Get grades for the current teacher/wali-kelas with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
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
    const whereClause: any = {};

    // Teachers can only see their own grades; wali-kelas can see grades for their classes
    if (user.role === 'TEACHER') {
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
      const orConditions: any[] = [
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

    // Apply studentId filter for both TEACHER and WALI_KELAS
    if (studentId && (user.role === 'TEACHER' || user.role === 'WALI_KELAS')) {
      whereClause.studentId = studentId;
    }

    if (subjectId) {
      if (!whereClause.competency) whereClause.competency = {};
      whereClause.competency.subjectId = subjectId;
    }

    if (assessmentType) {
      whereClause.assessmentType = assessmentType;
    }

    console.log('GET /api/teacher/grades - User:', user.role, user.id);
    console.log('Filters - classId:', classId, 'studentId:', studentId, 'subjectId:', subjectId);
    console.log('Where clause:', JSON.stringify(whereClause, null, 2));

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
        teacher: true,
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.grade.count({ where: whereClause });

    console.log('Found grades:', grades.length, 'Total:', total);
    if (grades.length > 0) {
      console.log('First grade:', grades[0]);
    }

    return paginatedResponse(
      grades.map((g: any) => ({
        id: g.id,
        studentId: g.studentId,
        studentName: g.student.name,
        studentNo: g.student.studentNo || '-',
        studentNisn: g.student.studentNo || '-',
        studentNourut: g.student.nourut,
        className: g.student.class?.name || '-',
        competencyId: g.competencyId,
        competencyName: g.competency.name,
        subjectName: g.competency.subject.name,
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
    console.error('Get grades error:', error);
    return errorResponse('Failed to fetch grades', 500);
  }
}

/**
 * POST /api/teacher/grades
 * Create a new grade
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Allow both TEACHER and WALI_KELAS
    if (user.role !== 'TEACHER' && user.role !== 'WALI_KELAS') {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    console.log('POST /api/teacher/grades - Request body:', body);
    const validatedData = gradeSchema.parse(body);

    // Verify that student exists in a class taught by/assigned to this user
    let classTeacher;
    if (user.role === 'TEACHER') {
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

    if (user.role === 'TEACHER' && !classTeacher) {
      return errorResponse('Student not found in your classes', 400);
    }

    // Verify that competency exists
    const competency = await prisma.competency.findUnique({
      where: { id: validatedData.competencyId },
      include: {
        subject: true,
      },
    });

    if (!competency) {
      return errorResponse('Competency not found', 404);
    }

    // Check if grade already exists with same combination
    const existingGrade = await prisma.grade.findUnique({
      where: {
        studentId_competencyId_teacherId_assessmentType: {
          studentId: validatedData.studentId,
          competencyId: validatedData.competencyId,
          teacherId: user.id,
          assessmentType: validatedData.assessmentType,
        },
      },
    });

    let grade;
    if (existingGrade) {
      // Update existing grade
      grade = await prisma.grade.update({
        where: { id: existingGrade.id },
        data: {
          score: String(validatedData.score),
          notes: validatedData.notes,
        },
        include: {
          student: true,
          competency: {
            include: {
              subject: true,
            },
          },
        },
      });
    } else {
      // Create new grade
      grade = await prisma.grade.create({
        data: {
          studentId: validatedData.studentId,
          competencyId: validatedData.competencyId,
          score: String(validatedData.score),
          assessmentType: validatedData.assessmentType,
          notes: validatedData.notes,
          teacherId: user.id,
          levelId: competency.subject.levelId || '',
          scoringType: 'NUMERIC_0_100',
        },
        include: {
          student: true,
          competency: {
            include: {
              subject: true,
            },
          },
        },
      });
    }

    console.log('Grade saved successfully:', grade.id, 'for student:', grade.studentId, 'competency:', grade.competencyId);

    return successResponse({
      id: grade.id,
      studentId: grade.studentId,
      studentName: grade.student.name,
      competencyId: grade.competencyId,
      competencyName: grade.competency.name,
      subjectName: grade.competency.subject.name,
      score: grade.score,
      assessmentType: grade.assessmentType,
      notes: grade.notes || '',
      message: existingGrade ? 'Nilai berhasil diperbarui' : 'Nilai berhasil ditambahkan',
      date: grade.createdAt?.toISOString().split('T')[0],
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error details:', error.issues);
      const fieldErrors = error.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return errorResponse('Validation error', 400, fieldErrors);
    }
    console.error('Create grade error:', error);
    return errorResponse('Failed to create grade', 500);
  }
}
