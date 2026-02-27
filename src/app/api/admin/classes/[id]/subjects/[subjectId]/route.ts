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
 * GET /api/admin/classes/[id]/subjects/[subjectId]
 * Get a specific class subject relationship
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subjectId: string }> }
) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id, subjectId } = await params;

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

    const classSubject = await prisma.classSubject.findUnique({
      where: {
        classId_subjectId: {
          classId: id,
          subjectId,
        },
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

    if (!classSubject) {
      return errorResponse('Subject not found in this class', 404);
    }

    return successResponse(classSubject, 'Subject retrieved successfully');
  } catch (error: any) {
    console.error('Get class subject error:', error);
    return errorResponse('Failed to retrieve subject', 500);
  }
}

/**
 * DELETE /api/admin/classes/[id]/subjects/[subjectId]
 * Remove a subject from a class
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subjectId: string }> }
) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id, subjectId } = await params;
    console.log('[DELETE ClassSubject] Params:', { id, subjectId, userId: user.id, userRole: user.role });

    // Verify the class exists
    const classData = await prisma.class.findUnique({
      where: { id },
      select: { id: true, waliKelasId: true },
    });

    if (!classData) {
      console.log('[DELETE ClassSubject] Class not found:', id);
      return errorResponse('Class not found', 404);
    }

    // If user is WALI_KELAS, verify they own this class
    if (user.role === 'WALI_KELAS' && classData.waliKelasId !== user.id) {
      console.log('[DELETE ClassSubject] Unauthorized WALI_KELAS:', { userId: user.id, classWaliKelasId: classData.waliKelasId });
      return errorResponse('Unauthorized', 403);
    }

    // Check if the ClassSubject exists first
    const existingClassSubject = await prisma.classSubject.findUnique({
      where: {
        classId_subjectId: {
          classId: id,
          subjectId,
        },
      },
    });

    if (!existingClassSubject) {
      console.log('[DELETE ClassSubject] ClassSubject not found:', { classId: id, subjectId });
      return errorResponse('Subject not found in this class', 404);
    }

    // Delete class subject
    const deleted = await prisma.classSubject.delete({
      where: {
        classId_subjectId: {
          classId: id,
          subjectId,
        },
      },
    });

    console.log('[DELETE ClassSubject] Successfully deleted:', { classId: id, subjectId });
    return successResponse(deleted, 'Subject removed from class');
  } catch (error: any) {
    console.error('Delete subject from class error:', error);
    if (error.code === 'P2025') {
      return errorResponse('Subject not found in this class', 404);
    }
    return errorResponse('Failed to remove subject from class', 500);
  }
}
