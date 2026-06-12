import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTeacherOrWaliKelas } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

export async function GET(request: NextRequest) {
  try {
    const teacher = await requireTeacherOrWaliKelas(request);

    if (!teacher) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all subjects for this teacher through ClassTeacher relationship
    const classTeachers = await prisma.classTeacher.findMany({
      where: {
        teacherId: teacher.id,
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
      class: {
          select: {
            id: true,
            name: true,
            semester: {
              select: {
                id: true,
                number: true,
              },
            },
            schoolYear: {
              select: {
                id: true,
                year: true,
              },
            },
            level: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Group by subject and aggregate classes
    const subjectsMap = new Map<string, {
      id: string;
      code: string;
      name: string;
      nameArabic: string | null;
      description: string | null;
      creditHours: number | null;
      classes: {
        id: string;
        name: string;
        semester: { id: string; number: number } | null;
        schoolYear: { id: string; year: string } | null;
        level: { id: string; name: string } | null;
      }[];
    }>();
    
    classTeachers.forEach((ct) => {
      const key = ct.subject.id;
      if (subjectsMap.has(key)) {
        const existing = subjectsMap.get(key);
        if (!existing) return;
        // Add class if not already present
        if (!existing.classes.find((c) => c.id === ct.class.id)) {
          existing.classes.push({
            id: ct.class.id,
            name: ct.class.name,
            semester: ct.class.semester,
            schoolYear: ct.class.schoolYear,
            level: ct.class.level,
          });
        }
      } else {
        subjectsMap.set(key, {
          id: ct.subject.id,
          code: ct.subject.code,
          name: ct.subject.name,
          nameArabic: ct.subject.nameArabic,
          description: ct.subject.description,
          creditHours: ct.subject.creditHours,
          classes: [{
            id: ct.class.id,
            name: ct.class.name,
            semester: ct.class.semester,
            schoolYear: ct.class.schoolYear,
            level: ct.class.level,
          }],
        });
      }
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
    serverError('Get teacher subjects error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subjects' },
      { status: 500 }
    );
  }
}
