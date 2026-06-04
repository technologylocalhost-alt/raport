import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireWaliKelasOnly } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

export async function GET(request: NextRequest) {
  try {
    const user = await requireWaliKelasOnly(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all classes where user is wali kelas
    const classes = await prisma.class.findMany({
      where: {
        waliKelasId: user.id,
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
      data: classes.map((c) => ({
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
    serverError('Error fetching wali kelas classes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
