import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
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
  
  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL')) {
    return user;
  }
  return null;
}

async function verifyUser(req: NextRequest) {
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
  
  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL' || user.role === 'TEACHER' || user.role === 'WALI_KELAS')) {
    return user;
  }
  return null;
}

const subjectSchema = z.object({
  code: z.string().min(1, 'Subject code is required').optional(),
  name: z.string().min(1, 'Subject name is required').optional(),
  nameArabic: z.string().optional(),
  description: z.string().optional(),
  creditHours: z.number().optional(),
});

/**
 * GET /api/admin/subjects/[id]
 * Get a subject by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await verifyUser(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        level: true,
        competencies: true,
      },
    });

    if (!subject) {
      return errorResponse('Subject not found', 404);
    }

    return successResponse(subject);
  } catch (error) {
    console.error('Get subject error:', error);
    return errorResponse('Failed to fetch subject', 500);
  }
}

/**
 * PUT /api/admin/subjects/[id]
 * Update a subject
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await verifyAdmin(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const validatedData = subjectSchema.parse(body);

    // Check if subject exists
    const existingSubject = await prisma.subject.findUnique({
      where: { id },
    });

    if (!existingSubject) {
      return errorResponse('Subject not found', 404);
    }

    const subject = await prisma.subject.update({
      where: { id },
      data: validatedData,
      include: {
        level: true,
        competencies: true,
      },
    });

    return successResponse(subject);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    console.error('Update subject error:', error);
    return errorResponse('Failed to update subject', 500);
  }
}

/**
 * DELETE /api/admin/subjects/[id]
 * Delete a subject
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await verifyAdmin(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    // Check if subject exists
    const existingSubject = await prisma.subject.findUnique({
      where: { id },
    });

    if (!existingSubject) {
      return errorResponse('Subject not found', 404);
    }

    // Check if subject has any competencies
    const competencyCount = await prisma.competency.count({
      where: { subjectId: id },
    });

    if (competencyCount > 0) {
      return errorResponse(
        'Cannot delete subject with existing competencies. Delete all competencies first.',
        400
      );
    }

    await prisma.subject.delete({
      where: { id },
    });

    return successResponse({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Delete subject error:', error);
    return errorResponse('Failed to delete subject', 500);
  }
}
