import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth/jwt';

const importGradeSchema = z.object({
  studentNo: z.string().min(1, 'Student number is required'),
  competencyName: z.string().optional(), // Make competency optional
  score: z
    .union([z.string(), z.number()])
    .transform((val) => parseFloat(String(val)))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 10, {
      message: 'Score must be a number between 1 and 10',
    }),
  assessmentType: z.enum([
    'UTS_1',
    'UAS_1',
    'UTS_2',
    'UAS_2',
    'FINAL_EXAM_1',
    'FINAL_EXAM_2',
  ]),
  notes: z.string().optional(),
});

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

  if (user && (user.role === 'TEACHER' || user.role === 'WALI_KELAS' || user.role === 'ADMIN')) {
    return user;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    // Get user
    const user = await getUser(req);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Get query params
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('classId');
    const subjectId = searchParams.get('subjectId');

    if (!classId || !subjectId) {
      return errorResponse('Class ID and Subject ID are required', 400);
    }

    // Get request body
    const body = await req.json();
    if (!Array.isArray(body)) {
      return errorResponse('Request body must be an array', 400);
    }

    // Validate all rows
    const validatedRows = body.map((row) => {
      try {
        return importGradeSchema.parse(row);
      } catch (err) {
        throw new Error(`Row validation error: ${err}`);
      }
    });

    // Get all students in class
    const classStudents = await prisma.student.findMany({
      where: { classId },
      include: { class: { include: { level: true } } },
    });

    // Get all competencies for subject
    const competencies = await prisma.competency.findMany({
      where: { subjectId },
    });

    // Get class data for levelId
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: { level: true },
    });

    if (!classData) {
      return errorResponse('Class not found', 404);
    }

    const levelId = classData.levelId;
    const teacherId = user.id;
    const results: {
      success: number;
      created: number;
      updated: number;
      failed: number;
      errors: Array<{ row: number; error: string }>;
    } = {
      success: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < validatedRows.length; i++) {
      const row = validatedRows[i];

      // Find student by studentNo
      const student = classStudents.find(
        (s) => s.studentNo === row.studentNo
      );
      if (!student) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          error: `Student with number ${row.studentNo} not found in this class`,
        });
        continue;
      }

      // Find competency by name (case-insensitive) - only if competencyName is provided
      let competency: any = null;
      if (row.competencyName && row.competencyName.trim() !== '') {
        competency = competencies.find(
          (c) => c.name.toLowerCase() === row.competencyName!.toLowerCase()
        );
        
        if (!competency) {
          results.failed++;
          results.errors.push({
            row: i + 2,
            error: `Kompetensi "${row.competencyName}" tidak ditemukan untuk mata pelajaran ini`,
          });
          continue;
        }
      }

      try {
        // Create or update grade
        const existingGrade = await prisma.grade.findFirst({
          where: {
            studentId: student.id,
            competencyId: competency?.id || null,
            assessmentType: row.assessmentType,
            subjectId: subjectId, // IMPORTANT: Filter by subjectId to prevent overwriting other subjects
          },
        });

        if (existingGrade) {
          // Update existing grade
          await prisma.grade.update({
            where: { id: existingGrade.id },
            data: {
              score: String(row.score),
              notes: row.notes,
              subjectId: subjectId, // Ensure subjectId is still correct
            },
          });
          results.updated++;
        } else {
          // Create new grade
          await prisma.grade.create({
            data: {
              studentId: student.id,
              classId: student.classId, // Add classId from student's class
              competencyId: competency?.id || null, // Allow null if no competency
              subjectId: subjectId, // Always set subjectId from import
              levelId: levelId,
              teacherId: teacherId,
              score: String(row.score),
              assessmentType: row.assessmentType,
              notes: row.notes || '',
              scoringType: 'NUMERIC_0_100',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          results.created++;
        }

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          error: `Failed to save grade: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    return successResponse(
      {
        successCount: results.success,
        createdCount: results.created,
        updatedCount: results.updated,
        failedCount: results.failed,
        errors: results.errors.length > 0 ? results.errors : undefined,
      },
      200
    );
  } catch (error) {
    console.error('Error in grade import:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}
