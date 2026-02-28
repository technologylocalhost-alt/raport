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
 * GET /api/admin/grades/per-class
 * Get all students grades grouped by class
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

    // Get all classes matching filters
    const classes = await prisma.class.findMany({
      where: classWhere,
      include: {
        level: { select: { id: true, name: true } },
        students: {
          select: {
            id: true,
            name: true,
            studentNo: true,
            grades: { select: { score: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Process and format data
    const gradesPerClass = classes.map((cls) => {
      const studentsWithScores = cls.students.map((student) => {
        let totalScore = 0;
        let scoreCount = 0;

        student.grades.forEach((grade) => {
          const scoreNum = parseFloat(grade.score);
          if (!isNaN(scoreNum)) {
            totalScore += scoreNum;
            scoreCount++;
          }
        });

        const averageScore = scoreCount > 0 ? totalScore / scoreCount : 0;

        return {
          id: student.id,
          name: student.name,
          studentNo: student.studentNo,
          averageScore,
        };
      });

      // Sort students by average score (descending)
      studentsWithScores.sort((a, b) => b.averageScore - a.averageScore);

      // Calculate class average
      const classTotal = studentsWithScores.reduce((sum, s) => sum + s.averageScore, 0);
      const classAverage = studentsWithScores.length > 0 ? classTotal / studentsWithScores.length : 0;

      return {
        classId: cls.id,
        className: cls.name,
        levelName: cls.level.name,
        totalStudents: cls.students.length,
        averageScore: classAverage,
        students: studentsWithScores,
      };
    });

    return successResponse(gradesPerClass, 'Berhasil mengambil data nilai per kelas');
  } catch (error) {
    console.error('Get grades per class error:', error);
    return errorResponse('Failed to fetch grades per class', 500);
  }
}
