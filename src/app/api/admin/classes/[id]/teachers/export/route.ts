import { NextRequest, NextResponse } from 'next/server';
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

  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL' || user.role === 'WALI_KELAS')) {
    return user;
  }
  return null;
}

/**
 * GET /api/admin/classes/[id]/teachers/export
 * Export teachers as CSV
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = await params;

    // Verify the class exists
    const classData = await prisma.class.findUnique({
      where: { id },
      select: { id: true, waliKelasId: true, name: true },
    });

    if (!classData) {
      return new NextResponse('Class not found', { status: 404 });
    }

    // If user is WALI_KELAS, verify they own this class
    if (user.role === 'WALI_KELAS' && classData.waliKelasId !== user.id) {
      return new NextResponse('Unauthorized', { status: 403 });
    }

    const teachers = await prisma.classTeacher.findMany({
      where: { classId: id },
      include: {
        teacher: {
          select: {
            name: true,
            email: true,
          },
        },
        subject: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      orderBy: [{ teacher: { name: 'asc' } }, { subject: { code: 'asc' } }],
    });

    // Build CSV
    const csv = [
      'Nama Guru,Email,Kode Mata Pelajaran,Mata Pelajaran',
      ...teachers.map(ct => [
        ct.teacher.name,
        ct.teacher.email,
        ct.subject.code,
        ct.subject.name,
      ].join(',')),
    ].join('\n');

    const fileName = `guru-pengajar-${classData.name}-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('Export teachers error:', error);
    return new NextResponse('Failed to export teachers', { status: 500 });
  }
}
