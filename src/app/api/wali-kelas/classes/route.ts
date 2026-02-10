import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = verifyAccessToken(token);
    if (!user || user.role !== 'WALI_KELAS') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all classes where user is wali kelas
    const classes = await prisma.class.findMany({
      where: {
        waliKelasId: user.userId,
      },
      include: {
        level: true,
        semester: true,
        schoolYear: true,
        students: true,
      },
      orderBy: [
        { schoolYear: { year: 'desc' } },
        { semester: { number: 'desc' } },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: classes.map((c: any) => ({
        id: c.id,
        name: c.name,
        levelName: c.level?.name,
        levelCode: c.level?.code,
        semesterNumber: c.semester?.number,
        schoolYear: c.schoolYear?.year,
        studentCount: c.students.length,
        capacity: c.capacity,
      })),
    });
  } catch (error) {
    console.error('Error fetching wali kelas classes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
