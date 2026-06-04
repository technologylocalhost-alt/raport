import { AssessmentType } from '@prisma/client';
import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { requireWaliKelasOnly } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

async function requireGradesForApprovalAccess(req: NextRequest) {
  return requireWaliKelasOnly(req);
}

/**
 * GET /api/wali-kelas/grades-for-approval
 * Get grades grouped by subject and class for approval
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireGradesForApprovalAccess(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const classId = searchParams.get('classId') || '';
    const studentId = searchParams.get('studentId') || '';
    const assessmentType = searchParams.get('assessmentType') || '';

    // Get the wali kelas's classes
    const query: { where: { waliKelasId: string; id?: string } } = {
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
    const gradeWhere = {
      student: {
        classId: {
          in: classIds,
        },
        ...(studentId ? { id: studentId } : {}),
      },
      ...(assessmentType && Object.values(AssessmentType).includes(assessmentType as AssessmentType)
        ? { assessmentType: assessmentType as AssessmentType }
        : {}),
    };

    const grades = await prisma.grade.findMany({
      where: gradeWhere,
      include: {
        student: {
          include: {
            class: true,
          },
        },
        subject: true,
        competency: true,
        teacher: true,
      },
    });

    // Group by subject and class
    const gradesBySubject: Record<
      string,
      {
        subjectId: string;
        subjectName: string;
        classId: string;
        className: string;
        totalStudents: number;
        gradesCount: number;
        teachers: Set<string>;
        grades: Array<{
          id: string;
          studentId: string;
          studentName: string;
          gender: string;
          competencyName: string;
          score: string;
          assessmentType: AssessmentType;
          teacherName: string;
        }>;
      }
    > = {};

    grades.forEach((grade) => {
      // Skip grades without subject (cannot group without a subject)
      if (!grade.subject || !grade.subjectId) {
        return;
      }

      // Group by subjectId and classId (no longer skipping grades without competency)
      const key = `${grade.subjectId}-${grade.student.classId}`;

      if (!gradesBySubject[key]) {
        const classData = classes.find((c) => c.id === grade.student.classId);
        gradesBySubject[key] = {
          subjectId: grade.subjectId,
          subjectName: grade.subject.name,
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
        competencyName: grade.competency?.name || '(Tanpa Kompetensi)',
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
    serverError('Error fetching grades for approval:', error);
    return errorResponse('Failed to fetch grades', 500);
  }
}
