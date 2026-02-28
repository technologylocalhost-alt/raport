import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { extractAccessToken } from '@/lib/auth/token-extractor';

async function verifyAdmin(req: NextRequest) {
  const token = extractAccessToken(req);
  if (!token) return null;
  const payload = verifyAccessToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL')) return user;
  return null;
}

/**
 * GET /api/admin/students/grades
 * Get grades untuk multiple students by IDs
 * Query params: studentIds (comma-separated), limit
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) return errorResponse('Unauthorized', 401);

    const searchParams = request.nextUrl.searchParams;
    const studentIdsParam = searchParams.get('studentIds') || '';
    const limit = parseInt(searchParams.get('limit') || '500');

    if (!studentIdsParam) {
      return errorResponse('studentIds parameter is required', 400);
    }

    const studentIds = studentIdsParam.split(',').filter(id => id.trim());
    
    if (studentIds.length === 0) {
      return successResponse(
        { grades: [] },
        'Success'
      );
    }

    // Fetch grades untuk student-student tersebut
    const grades = await prisma.grade.findMany({
      where: {
        studentId: { in: studentIds },
      },
      select: {
        id: true,
        studentId: true,
        score: true,
        scoringType: true,
        assessmentType: true,
        competency: {
          select: { name: true }
        }
      },
      take: limit,
    });

    return successResponse(
      { grades, count: grades.length },
      'Success'
    );
  } catch (error) {
    console.error('Get student grades error:', error);
    return errorResponse('Failed to fetch grades', 500);
  }
}
