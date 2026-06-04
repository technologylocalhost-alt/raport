import { AssessmentType } from '@prisma/client';
import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { requireTeacherWaliAdminPrincipal } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

async function requireApprovedGradeAccess(req: NextRequest) {
  return requireTeacherWaliAdminPrincipal(req);
}

/**
 * GET /api/wali-kelas/nilai-approve
 * Get approved grades (NilaiApprove) for a student in a class
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireApprovedGradeAccess(request);

    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const studentId = searchParams.get('studentId') || '';
    const classId = searchParams.get('classId') || '';
    const assessmentType = searchParams.get('assessmentType') || '';

    // Validate at least classId is provided
    if (!classId) {
      return errorResponse('classId is required', 400);
    }

    // Verify the class exists
    const classData = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classData) {
      return errorResponse('Class not found', 404);
    }

    // If studentId is provided, verify the student belongs to this class
    if (studentId) {
      const student = await prisma.student.findFirst({
        where: {
          id: studentId,
          classId: classId,
        },
      });

      if (!student) {
        return errorResponse('Student not found in this class', 404);
      }
    }

    // Fetch approved grades for this class (or specific student if provided)
    const approvedGrades = await prisma.nilaiApprove.findMany({
      where: {
        ...(studentId ? { studentId } : {}),
        ...(assessmentType && Object.values(AssessmentType).includes(assessmentType as AssessmentType)
          ? { assessmentType: assessmentType as AssessmentType }
          : {}),
        // Filter by classId through student's class relationship
        student: {
          classId,
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
      subjectCode: grade.subject.code,
      competencyId: grade.competencyId || '',
      competencyName: grade.competency?.name || '',
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
    serverError('Error fetching NilaiApprove:', error);
    return errorResponse('Failed to fetch approved grades', 500);
  }
}
