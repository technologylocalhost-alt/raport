import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/api-response';
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

  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL')) {
    return user;
  }
  return null;
}

/**
 * GET /api/admin/subjects-with-classes
 * Get all subjects with their associated classes for admin
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
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
    const subjectsMap = new Map<string, any>();

    classes.forEach((cls) => {
      cls.subjects.forEach((cs) => {
        const key = cs.subject.id;
        if (subjectsMap.has(key)) {
          const existing = subjectsMap.get(key);
          // Add class if not already present
          if (!existing.classes.find((c: any) => c.id === cls.id)) {
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
    console.error('Get admin subjects with classes error:', error);
    return errorResponse('Failed to fetch subjects', 500);
  }
}
