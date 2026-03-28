import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decoded = verifyAccessToken(token);
    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get all classes where teacher has students (from ClassTeacher)
    const classTeachers = await prisma.classTeacher.findMany({
      where: {
        teacherId: decoded.userId,
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Get unique classes
    const uniqueClassesMap = new Map();
    const uniqueSubjectsMap = new Map();

    classTeachers.forEach((ct: any) => {
      if (ct.class && ct.class.id) {
        uniqueClassesMap.set(ct.class.id, ct.class);
      }
      if (ct.subject && ct.subject.id) {
        uniqueSubjectsMap.set(ct.subject.id, ct.subject);
      }
    });

    const classes = Array.from(uniqueClassesMap.values()).sort((a: any, b: any) => 
      a.name.localeCompare(b.name)
    );
    const subjects = Array.from(uniqueSubjectsMap.values()).sort((a: any, b: any) => 
      a.name.localeCompare(b.name)
    );

    return NextResponse.json({
      success: true,
      classes,
      subjects,
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memuat opsi filter' },
      { status: 500 }
    );
  }
}
