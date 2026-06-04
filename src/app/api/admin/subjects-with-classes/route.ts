import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { requireMenuAccess } from '@/lib/auth/verify-access';
import { serverError } from '@/lib/server-log';

async function requireSubjectsWithClassesAccess(req: NextRequest) {
  return requireMenuAccess(req, '/admin/penilaian', ['ADMIN', 'PRINCIPAL']);
}

/**
 * GET /api/admin/subjects-with-classes
 * Get all subjects with their associated classes for admin
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireSubjectsWithClassesAccess(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Get all classes with their subjects
    const classes = await prisma.class.findMany({
      select: {
        id: true,
        name: true,
        levelId: true,
        schoolYearId: true,
        subjects: {
          include: {
            subject: {
              select: {
                id: true,
                code: true,
                name: true,
                nameArabic: true,
                description: true,
                creditHours: true,
                levelId: true,
              },
            },
          },
        },
      },
    });

    // Group by subject and aggregate classes
    const subjectsMap = new Map<string, { id: string; code: string; name: string; nameArabic: string | null; description: string | null; creditHours: number | null; levelId: string | null; classes: { id: string; name: string; schoolYearId: string; }[] }>();

    classes.forEach((cls) => {
      cls.subjects.forEach((cs) => {
        const key = cs.subject.id;
        if (subjectsMap.has(key)) {
          const existing = subjectsMap.get(key);
          if (!existing) return;
          // Add class if not already present
          if (!existing.classes.find((c) => c.id === cls.id)) {
            existing.classes.push({
              id: cls.id,
              name: cls.name,
              schoolYearId: cls.schoolYearId,
            });
          }
        } else {
          subjectsMap.set(key, {
            id: cs.subject.id,
            code: cs.subject.code,
            name: cs.subject.name,
            nameArabic: cs.subject.nameArabic,
            description: cs.subject.description,
            creditHours: cs.subject.creditHours,
            levelId: cs.subject.levelId,
            classes: [{
              id: cls.id,
              name: cls.name,
              schoolYearId: cls.schoolYearId,
            }],
          });
        }
      });
    });

    const uniqueSubjects = Array.from(subjectsMap.values()).sort((a, b) =>
      a.code.localeCompare(b.code)
    );

    return NextResponse.json({
      success: true,
      data: uniqueSubjects,
      total: uniqueSubjects.length,
    });
  } catch (error) {
    serverError('Get admin subjects with classes error:', error);
    return errorResponse('Failed to fetch subjects', 500);
  }
}
