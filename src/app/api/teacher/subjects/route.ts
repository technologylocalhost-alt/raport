import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';

export async function GET(request: NextRequest) {
  try {
    // Verify token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const teacher = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!teacher) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Allow both TEACHER and WALI_KELAS roles
    if (teacher.role !== 'TEACHER' && teacher.role !== 'WALI_KELAS') {
      return NextResponse.json(
        { success: false, error: 'Not authorized' },
        { status: 403 }
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
          },
        },
      },
    });

    // Group by subject and aggregate classes
    const subjectsMap = new Map<string, any>();
    
    classTeachers.forEach((ct) => {
      const key = ct.subject.id;
      if (subjectsMap.has(key)) {
        const existing = subjectsMap.get(key);
        // Add class if not already present
        if (!existing.classes.find((c: any) => c.id === ct.class.id)) {
          existing.classes.push({ id: ct.class.id, name: ct.class.name });
        }
      } else {
        subjectsMap.set(key, {
          id: ct.subject.id,
          code: ct.subject.code,
          name: ct.subject.name,
          nameArabic: ct.subject.nameArabic,
          description: ct.subject.description,
          creditHours: ct.subject.creditHours,
          classes: [{ id: ct.class.id, name: ct.class.name }],
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
    console.error('Get teacher subjects error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subjects' },
      { status: 500 }
    );
  }
}

