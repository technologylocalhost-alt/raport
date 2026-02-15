import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';

async function getUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  console.log('[NilaiApprove] Auth Header:', authHeader ? `Bearer ${authHeader.slice(0, 50)}...` : 'missing');
  
  if (!authHeader?.startsWith('Bearer ')) {
    console.log('[NilaiApprove] Invalid auth header format:', authHeader?.slice(0, 50));
    return null;
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);
  console.log('[NilaiApprove] Token verification result:', payload ? `success (userId: ${payload.userId}, role: ${payload.role})` : 'failed');

  if (!payload) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  console.log('[NilaiApprove] User database lookup:', user ? `found (role: ${user.role})` : 'not found');
  
  // Return user if authenticated (any role for now, restrict at endpoint level if needed)
  if (user) {
    console.log('[NilaiApprove] Authorization passed for user:', user.id);
    return user;
  }
  console.log('[NilaiApprove] User not found in database');
  return null;
}

/**
 * GET /api/wali-kelas/nilai-approve
 * Get approved grades (NilaiApprove) for a student in a class
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    console.log('[NilaiApprove] GET request - authenticated user:', user ? `${user.id} (${user.role})` : 'none');
    
    if (!user) {
      console.log('[NilaiApprove] Rejecting request - no authenticated user');
      return errorResponse('Unauthorized', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const studentId = searchParams.get('studentId') || '';
    const classId = searchParams.get('classId') || '';
    const limit = parseInt(searchParams.get('limit') || '100');

    console.log('[NilaiApprove] Request params:', { studentId, classId, limit });

    // Validate at least classId is provided
    if (!classId) {
      console.log('[NilaiApprove] Missing required classId parameter');
      return errorResponse('classId is required', 400);
    }

    // Verify the class exists
    const classData = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classData) {
      console.log('[NilaiApprove] Class not found:', classId);
      return errorResponse('Class not found', 404);
    }

    console.log('[NilaiApprove] Class found:', classData.id);

    // If studentId is provided, verify the student belongs to this class
    if (studentId) {
      const student = await prisma.student.findFirst({
        where: {
          id: studentId,
          classId: classId,
        },
      });

      if (!student) {
        console.log('[NilaiApprove] Student not found in class');
        return errorResponse('Student not found in this class', 404);
      }
    }

    // Fetch approved grades for this class (or specific student if provided)
    const approvedGrades = await prisma.nilaiApprove.findMany({
      where: {
        ...(studentId ? { studentId: studentId } : {}),
        // Optional: can filter by classId through subject's levelId if needed
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            nameArabic: true,
          },
        },
        competency: {
          select: {
            id: true,
            name: true,
            subjectId: true,
          },
        },
        student: {
          select: {
            id: true,
            name: true,
            studentNo: true,
          },
        },
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { subjectId: 'asc' },
        { assessmentType: 'asc' },
      ],
    });

    // Group by subject and aggregate scores
    const groupedBySubject: { [key: string]: any } = {};
    
    approvedGrades.forEach((grade) => {
      const subjectId = grade.subjectId;
      
      if (!groupedBySubject[subjectId]) {
        groupedBySubject[subjectId] = {
          id: grade.id,
          studentId: grade.studentId,
          subjectId: grade.subjectId,
          levelId: grade.levelId,
          teacherId: grade.teacherId,
          scoringType: grade.scoringType,
          notes: grade.notes,
          nomorRaport: grade.nomorRaport,
          suluk: grade.suluk,
          muazobah: grade.muazobah,
          nazofah: grade.nazofah,
          averageStudent: grade.averageStudent,
          averageSubject: grade.averageSubject,
          subject: grade.subject,
          dailyScore: 0,
          midScore: 0,
          finalScore: 0,
          scores: [], // all raw scores by assessment type
          createdAt: grade.createdAt,
          updatedAt: grade.updatedAt,
        };
      }
      
      // Map assessment types to score fields
      const scoreValue = parseFloat(grade.score || '0');
      switch (grade.assessmentType) {
        case 'DAILY':
          groupedBySubject[subjectId].dailyScore = scoreValue;
          break;
        case 'MIDTERM':
          groupedBySubject[subjectId].midScore = scoreValue;
          break;
        case 'FINAL':
        case 'UAS':
          groupedBySubject[subjectId].finalScore = scoreValue;
          break;
      }
      
      groupedBySubject[subjectId].scores.push({
        assessmentType: grade.assessmentType,
        score: scoreValue,
      });
    });

    const data = Object.values(groupedBySubject);

    return successResponse(
      {
        data,
        total: data.length,
      },
      200
    );
  } catch (error) {
    console.error('Error fetching NilaiApprove:', error);
    return errorResponse('Failed to fetch approved grades', 500);
  }
}
