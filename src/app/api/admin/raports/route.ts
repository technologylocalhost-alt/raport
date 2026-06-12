import { AssessmentType, Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { paginatedResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { requireMenuAccess } from '@/lib/auth/verify-access';
import { serverError } from '@/lib/server-log';

async function requireRaportListAccess(req: NextRequest) {
  return requireMenuAccess(req, '/admin/raports', ['ADMIN', 'PRINCIPAL']);
}

/**
 * GET /api/admin/raports
 * Get all raports (NilaiApprove) with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRaportListAccess(request);
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
    const where: Prisma.NilaiApproveWhereInput = {};

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
    const studentFilter: Prisma.StudentWhereInput = {};

    if (filterClassId) {
      studentFilter.classId = filterClassId;
    } else if (filterClassName) {
      studentFilter.class = {
        is: {
          name: {
            contains: filterClassName,
            mode: 'insensitive',
          },
        },
      };
    }

    if (filterSubject) {
      where.subject = {
        is: {
          name: {
            contains: filterSubject,
            mode: 'insensitive',
          },
        },
      };
    }

    if (filterStudent) {
      studentFilter.name = {
        contains: filterStudent,
        mode: 'insensitive',
      };
    }

    if (Object.keys(studentFilter).length > 0) {
      where.student = studentFilter;
    }

    if (
      filterAssessmentType &&
      Object.values(AssessmentType).includes(filterAssessmentType as AssessmentType)
    ) {
      where.assessmentType = filterAssessmentType as AssessmentType;
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
    serverError('Error fetching raports:', error);
    return errorResponse('Failed to fetch raports', 500);
  }
}
