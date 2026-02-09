import { NextRequest, NextResponse } from 'next/server';
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
  
  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL' || user.role === 'WALI_KELAS')) {
    return user;
  }
  return null;
}

/**
 * GET /api/admin/classes/[id]/teachers
 * Get all teachers assigned to a specific class
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    // Verify the class exists
    const classData = await prisma.class.findUnique({
      where: { id },
      select: { id: true, waliKelasId: true },
    });

    if (!classData) {
      return errorResponse('Class not found', 404);
    }

    // If user is WALI_KELAS, verify they own this class
    if (user.role === 'WALI_KELAS' && classData.waliKelasId !== user.id) {
      return errorResponse('Unauthorized', 403);
    }

    const teachers = await prisma.classTeacher.findMany({
      where: { classId: id },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        subject: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: { teacher: { name: 'asc' } },
    });

    return successResponse(teachers, 'Teachers retrieved successfully');
  } catch (error: any) {
    console.error('Get class teachers error:', error);
    return errorResponse('Failed to retrieve teachers', 500);
  }
}

/**
 * POST /api/admin/classes/[id]/teachers
 * Add a teacher to a class for a specific subject
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    // Verify the class exists
    const classData = await prisma.class.findUnique({
      where: { id },
      select: { id: true, waliKelasId: true },
    });

    if (!classData) {
      return errorResponse('Class not found', 404);
    }

    // If user is WALI_KELAS, verify they own this class
    if (user.role === 'WALI_KELAS' && classData.waliKelasId !== user.id) {
      return errorResponse('Unauthorized', 403);
    }

    const body = await request.json();
    const { teacherId, subjectId } = body;

    if (!teacherId || !subjectId) {
      return errorResponse('Teacher ID and Subject ID are required', 400);
    }

    // Verify teacher exists
    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      return errorResponse('Teacher not found', 404);
    }

    // Verify subject exists
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      return errorResponse('Subject not found', 404);
    }

    // Verify subject is assigned to this class
    const classSubject = await prisma.classSubject.findUnique({
      where: {
        classId_subjectId: {
          classId: id,
          subjectId,
        },
      },
    });

    if (!classSubject) {
      return errorResponse('Subject not assigned to this class', 400);
    }

    // Check if teacher already assigned to teach this subject in this class
    const existing = await prisma.classTeacher.findUnique({
      where: {
        classId_teacherId_subjectId: {
          classId: id,
          teacherId,
          subjectId,
        },
      },
    });

    if (existing) {
      return errorResponse('Teacher already assigned to teach this subject in this class', 400);
    }

    // Create class teacher
    const classTeacher = await prisma.classTeacher.create({
      data: {
        classId: id,
        teacherId,
        subjectId,
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        subject: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return successResponse(classTeacher, 'Teacher added to class', 201);
  } catch (error: any) {
    console.error('Add teacher to class error:', error);
    if (error.code === 'P2002') {
      return errorResponse('Teacher already assigned to this subject in this class', 400);
    }
    return errorResponse('Failed to add teacher to class', 500);
  }
}
