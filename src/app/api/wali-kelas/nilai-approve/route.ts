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
    const assessmentType = searchParams.get('assessmentType') || '';
    const limit = parseInt(searchParams.get('limit') || '100');

    console.log('[NilaiApprove] Request params:', { studentId, classId, assessmentType, limit });

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
        ...(assessmentType ? { assessmentType: assessmentType as any } : {}),
        // Filter by classId through student's class relationship
        student: {
          classId: classId,
        },
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

    // Return raw data without grouping - let the client handle grouping
    // Format the data to include all necessary fields
    const formattedData = approvedGrades.map((grade) => ({
      id: grade.id,
      studentId: grade.studentId,
      studentName: grade.student.name,
      studentNo: grade.student.studentNo,
      subjectId: grade.subjectId,
      subjectName: grade.subject.name,
      competencyId: grade.competencyId,
      competencyName: grade.competency.name,
      levelId: grade.levelId,
      teacherId: grade.teacherId,
      teacherName: grade.teacher.name,
      score: grade.score,
      scoringType: grade.scoringType,
      assessmentType: grade.assessmentType,
      notes: grade.notes,
      nomorRaport: grade.nomorRaport,
      suluk: grade.suluk,
      muazobah: grade.muazobah,
      nazofah: grade.nazofah,
      averageStudent: grade.averageStudent,
      averageSubject: grade.averageSubject,
      jumlahNilai: grade.jumlahNilai,
      mulahazoh: grade.mulahazoh,
      createdAt: grade.createdAt,
      updatedAt: grade.updatedAt,
    }));

    return successResponse(
      {
        data: formattedData,
        total: formattedData.length,
      },
      200
    );
  } catch (error) {
    console.error('Error fetching NilaiApprove:', error);
    return errorResponse('Failed to fetch approved grades', 500);
  }
}
