import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireWaliKelasAdminPrincipal } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const user = await requireWaliKelasAdminPrincipal(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { classId } = await params;

    // Get all subjects for the class
    const subjects = await prisma.subject.findMany({
      where: {
        classSubjects: {
          some: {
            classId: classId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
        nameArabic: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: subjects,
    });
  } catch (error) {
    serverError('Error fetching class subjects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
