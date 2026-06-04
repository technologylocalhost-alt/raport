import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { requireTeacherOrWaliKelas } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

async function requireAssessmentStatusAccess(req: NextRequest) {
  return requireTeacherOrWaliKelas(req);
}

/**
 * GET /api/wali-kelas/assessment-status
 * Returns which assessment types have grades in the database for each subject.
 * 
 * Query params:
 *   - subjectId (optional): check specific subject
 * 
 * Response: { [subjectId]: string[] } map of subjectId to list of completed assessmentTypes
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAssessmentStatusAccess(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const subjectId = searchParams.get('subjectId') || '';

    // Build filter based on role
    // For WALI_KELAS: look at grades for students in classes they manage (via waliKelasId)
    // For TEACHER: look at grades they recorded
    const whereClause: Record<string, unknown> = {};

    if (user.role === 'WALI_KELAS') {
      whereClause.student = {
        class: {
          waliKelasId: user.id,
        },
      };
    } else if (user.role === 'TEACHER') {
      whereClause.teacherId = user.id;
    }

    if (subjectId) {
      whereClause.subjectId = subjectId;
    }

    // Use groupBy to get distinct subjectId + assessmentType combinations
    const results = await prisma.grade.findMany({
      where: whereClause,
      select: {
        assessmentType: true,
        subjectId: true,
      },
      distinct: ['assessmentType', 'subjectId'],
    });

    // Build map: subjectId -> Set<assessmentType>
    const statusMap: Record<string, string[]> = {};
    for (const row of results) {
      // Skip grades without a subject (cannot report status for them)
      if (!row.subjectId) continue;

      const sid = row.subjectId;
      if (!statusMap[sid]) statusMap[sid] = [];
      if (!statusMap[sid].includes(row.assessmentType)) {
        statusMap[sid].push(row.assessmentType);
      }
    }

    return successResponse(statusMap);
  } catch (error) {
    serverError('Error in GET /api/wali-kelas/assessment-status:', error);
    return errorResponse('Gagal memuat status penilaian', 500);
  }
}
