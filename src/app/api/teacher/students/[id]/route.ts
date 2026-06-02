import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const updateStudentSchema = z.object({
  studentNo: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  birthDate: z.string().datetime().optional(),
  address: z.string().optional(),
  parentPhoneNo: z.string().optional(),
});

/**
 * GET /api/teacher/students/[id]
 * Get a student by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        class: {
          include: {
            level: true,
          },
        },
        grades: {
          include: {
            competency: {
              include: {
                subject: true,
              },
            },
          },
        },
      },
    });

    if (!student) {
      return errorResponse('Student not found', 404);
    }

    return successResponse(student);
  } catch (error) {
    console.error('Get student error:', error);
    return errorResponse('Failed to fetch student', 500);
  }
}

/**
 * PUT /api/teacher/students/[id]
 * Update a student
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = updateStudentSchema.parse(body);

    // Check if student exists
    const existingStudent = await prisma.student.findUnique({
      where: { id },
    });

    if (!existingStudent) {
      return errorResponse('Student not found', 404);
    }

    const student = await prisma.student.update({
      where: { id },
      data: {
        ...validatedData,
        birthDate: validatedData.birthDate ? new Date(validatedData.birthDate) : undefined,
      },
      include: {
        class: {
          include: {
            level: true,
          },
        },
      },
    });

    return successResponse(student);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    console.error('Update student error:', error);
    return errorResponse('Failed to update student', 500);
  }
}

/**
 * DELETE /api/teacher/students/[id]
 * Delete a student
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Check if student exists
    const existingStudent = await prisma.student.findUnique({
      where: { id },
    });

    if (!existingStudent) {
      return errorResponse('Student not found', 404);
    }

    await prisma.student.delete({
      where: { id },
    });

    return successResponse({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    return errorResponse('Failed to delete student', 500);
  }
}
