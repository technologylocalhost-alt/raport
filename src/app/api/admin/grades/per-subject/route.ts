import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
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
 * GET /api/admin/grades/per-subject
 * Get average grades per subject for each class
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const schoolYearId = searchParams.get('schoolYearId');
    const levelId = searchParams.get('levelId');
    const semesterId = searchParams.get('semesterId');

    // Build where clause for classes
    const classWhere: any = {};
    if (schoolYearId) classWhere.schoolYearId = schoolYearId;
    if (levelId) classWhere.levelId = levelId;
    if (semesterId) classWhere.semesterId = semesterId;

    // Get all classes matching filters with their subjects and grades
    const classes = await prisma.class.findMany({
      where: classWhere,
      include: {
        level: { select: { id: true, name: true } },
        subjects: {
          include: {
            subject: { select: { id: true, name: true } },
          },
        },
        students: {
          include: {
            grades: {
              select: {
                score: true,
                subjectId: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Process and format data
    const gradesPerSubject = classes.map((cls) => {
      const subjectGrades: { [key: string]: { name: string; scores: number[] } } = {};

      // Initialize subjects with empty scores array
      cls.subjects.forEach((cs) => {
        subjectGrades[cs.subject.id] = {
          name: cs.subject.name,
          scores: [],
        };
      });

      // Collect all grades for each subject
      cls.students.forEach((student) => {
        student.grades.forEach((grade) => {
          // Include all grades (even without competency), but skip if no subjectId
          if (!grade.subjectId) {
            return;
          }

          const subjectId = grade.subjectId;
          const scoreNum = parseFloat(grade.score);

          if (!isNaN(scoreNum) && subjectGrades[subjectId]) {
            subjectGrades[subjectId].scores.push(scoreNum);
          }
        });
      });

      // Calculate average per subject
      const subjects = Object.entries(subjectGrades).map(([subjectId, data]) => ({
        subjectId,
        subjectName: data.name,
        averageScore:
          data.scores.length > 0
            ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
            : 0,
      }));

      // Sort subjects by average score (descending)
      subjects.sort((a, b) => b.averageScore - a.averageScore);

      return {
        classId: cls.id,
        className: cls.name,
        levelName: cls.level.name,
        subjects,
      };
    });

    return successResponse(gradesPerSubject, 'Berhasil mengambil data nilai rata-rata mata pelajaran per kelas');
  } catch (error) {
    console.error('Get grades per subject error:', error);
    return errorResponse('Failed to fetch grades per subject', 500);
  }
}
