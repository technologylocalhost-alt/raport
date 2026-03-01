import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';

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

  if (user?.role === 'WALI_KELAS') {
    return user;
  }
  return null;
}

/**
 * GET /api/wali-kelas/grades-for-approval
 * Get grades grouped by subject and class for approval
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const classId = searchParams.get('classId') || '';
    const studentId = searchParams.get('studentId') || '';
    const assessmentType = searchParams.get('assessmentType') || '';

    // Get the wali kelas's classes
    let query: any = {
      where: {
        waliKelasId: user.id,
      },
    };

    if (classId) {
      query.where.id = classId;
    }

    const classes = await prisma.class.findMany(query);

    if (classes.length === 0) {
      return successResponse(
        {
          subjectsByClass: [],
        },
        200
      );
    }

    const classIds = classes.map((c) => c.id);

    // Get all grades for these classes
    const grades = await prisma.grade.findMany({
      where: {
        student: {
          classId: {
            in: classIds,
          },
          ...(studentId ? { id: studentId } : {}),
        },
        ...(assessmentType ? { assessmentType: assessmentType as any } : {}),
      },
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
    });

    // Group by subject and class
    const gradesBySubject: {
      [key: string]: {
        subjectId: string;
        subjectName: string;
        classId: string;
        className: string;
        totalStudents: number;
        gradesCount: number;
        teachers: Set<string>;
        grades: any[];
      };
    } = {};

    grades.forEach((grade) => {
      // Skip grades without competency
      if (!grade.competency) {
        return;
      }

      const key = `${grade.competency.subjectId}-${grade.student.classId}`;

      if (!gradesBySubject[key]) {
        const classData = classes.find((c) => c.id === grade.student.classId);
        gradesBySubject[key] = {
          subjectId: grade.competency.subjectId,
          subjectName: grade.competency.subject.name,
          classId: grade.student.classId,
          className: classData?.name || 'N/A',
          totalStudents: 0, // Will be calculated from unique students
          gradesCount: 0,
          teachers: new Set<string>(),
          grades: [],
        };
      }

      gradesBySubject[key].gradesCount++;
      if (grade.teacher?.name) {
        gradesBySubject[key].teachers.add(grade.teacher.name);
      }
      gradesBySubject[key].grades.push({
        id: grade.id,
        studentId: grade.studentId,
        studentName: grade.student.name,
        gender: grade.student.gender || 'MALE',
        competencyName: grade.competency.name,
        score: grade.score,
        assessmentType: grade.assessmentType,
        teacherName: grade.teacher?.name || 'N/A',
      });
    });

    // Get unique student count per subject+class
    Object.values(gradesBySubject).forEach((subj) => {
      const uniqueStudents = new Set(subj.grades.map((g) => g.studentId));
      subj.totalStudents = uniqueStudents.size;
    });

    // Convert to array and check completion
    const subjectsByClass = Object.values(gradesBySubject).map((subj) => ({
      subjectId: subj.subjectId,
      subjectName: subj.subjectName,
      classId: subj.classId,
      className: subj.className,
      totalStudents: subj.totalStudents,
      gradesCount: subj.gradesCount,
      teachersCount: subj.teachers.size,
      teachers: Array.from(subj.teachers),
      isComplete: subj.gradesCount > 0, // At least some grades exist
      gradesSample: subj.grades.slice(0, 5), // First 5 grades as sample
    }));

    return successResponse(
      {
        subjectsByClass,
      },
      200
    );
  } catch (error) {
    console.error('Error fetching grades for approval:', error);
    return errorResponse('Failed to fetch grades', 500);
  }
}
