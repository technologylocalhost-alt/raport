import { NextRequest } from 'next/server';
import { successResponse, paginatedResponse, errorResponse } from '@/lib/api-response';
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

  // Only ADMIN and PRINCIPAL can view all raports
  if (user?.role === 'ADMIN' || user?.role === 'PRINCIPAL') {
    return user;
  }
  return null;
}

/**
 * GET /api/admin/raports
 * Get all raports (NilaiApprove) with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const filterClassId = searchParams.get('classId') || '';
    const filterClassName = searchParams.get('class') || '';
    const filterSubject = searchParams.get('subject') || '';
    const filterStudent = searchParams.get('student') || '';
    const filterAssessmentType = searchParams.get('assessmentType') || '';

    const skip = (page - 1) * limit;

    // Build where clause with filters
    const where: any = {};

    if (search) {
      where.OR = [
        {
          student: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          subject: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          teacher: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          competency: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    // Filter by class ID (priority) or class name
    if (filterClassId) {
      where.student = {
        ...where.student,
        classId: filterClassId,
      };
    } else if (filterClassName) {
      where.student = {
        ...where.student,
        class: {
          name: {
            contains: filterClassName,
            mode: 'insensitive',
          },
        },
      };
    }

    if (filterSubject) {
      where.subject = {
        ...where.subject,
        name: {
          contains: filterSubject,
          mode: 'insensitive',
        },
      };
    }

    if (filterStudent) {
      where.student = {
        ...where.student,
        name: {
          contains: filterStudent,
          mode: 'insensitive',
        },
      };
    }

    if (filterAssessmentType) {
      where.assessmentType = filterAssessmentType;
    }

    // Fetch total count
    const total = await prisma.nilaiApprove.count({
      where,
    });

    // Fetch paginated data
    const raports = await prisma.nilaiApprove.findMany({
      where,
      include: {
        student: {
          include: {
            class: true,
          },
        },
        subject: true,
        teacher: true,
        competency: true,
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      skip,
      take: limit,
    });

    const formattedData = raports.map((raport) => ({
      id: raport.id,
      studentId: raport.studentId,
      studentName: raport.student.name,
      studentNo: raport.student.studentNo,
      className: raport.student.class.name,
      subjectName: raport.subject.name,
      competencyName: raport.competency?.name || '',
      teacherName: raport.teacher.name,
      score: raport.score,
      scoringType: raport.scoringType,
      assessmentType: raport.assessmentType,
      nomorRaport: raport.nomorRaport,
      suluk: raport.suluk,
      muazobah: raport.muazobah,
      nazofah: raport.nazofah,
      createdAt: raport.createdAt,
      updatedAt: raport.updatedAt,
    }));

    return paginatedResponse(formattedData, total, page, limit);
  } catch (error) {
    console.error('Error fetching raports:', error);
    return errorResponse('Failed to fetch raports', 500);
  }
}
