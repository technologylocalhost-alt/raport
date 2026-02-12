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
 * GET /api/admin/classes/[id]/subjects
 * Get all subjects assigned to a specific class
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

    const subjects = await prisma.classSubject.findMany({
      where: { classId: id },
      include: {
        subject: {
          select: {
            id: true,
            code: true,
            name: true,
            nameArabic: true,
            description: true,
            creditHours: true,
          },
        },
      },
      orderBy: { subject: { code: 'asc' } },
    });

    return successResponse(subjects, 'Subjects retrieved successfully');
  } catch (error: any) {
    console.error('Get class subjects error:', error);
    return errorResponse('Failed to retrieve subjects', 500);
  }
}

/**
 * POST /api/admin/classes/[id]/subjects
 * Add a subject to a class
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
    const { subjectId } = body;

    if (!subjectId) {
      return errorResponse('Subject ID is required', 400);
    }

    // Verify subject exists
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      return errorResponse('Subject not found', 404);
    }

    // Check if subject already assigned to this class
    const existing = await prisma.classSubject.findUnique({
      where: {
        classId_subjectId: {
          classId: id,
          subjectId,
        },
      },
    });

    if (existing) {
      return errorResponse('Subject already assigned to this class', 400);
    }

    // Create class subject
    const classSubject = await prisma.classSubject.create({
      data: {
        classId: id,
        subjectId,
      },
      include: {
        subject: {
          select: {
            id: true,
            code: true,
            name: true,
            nameArabic: true,
            description: true,
            creditHours: true,
          },
        },
      },
    });

    return successResponse(classSubject, 'Subject added to class', 201);
  } catch (error: any) {
    console.error('Add subject to class error:', error);
    if (error.code === 'P2002') {
      return errorResponse('Subject already assigned to this class', 400);
    }
    return errorResponse('Failed to add subject to class', 500);
  }
}
