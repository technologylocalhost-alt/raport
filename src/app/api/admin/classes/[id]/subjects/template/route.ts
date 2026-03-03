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
 * GET /api/admin/classes/[id]/subjects/template
 * Download template for subjects import
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

    // Get all available subjects as examples
    const subjects = await prisma.subject.findMany({
      select: {
        code: true,
        name: true,
        nameArabic: true,
        creditHours: true,
        description: true,
      },
      take: 5,
      orderBy: { code: 'asc' },
    });

    // Build CSV with template and examples
    const csv = [
      'Kode,Nama,Nama Arab,Jam Kredit,Deskripsi',
      ...subjects.map(s => [
        s.code,
        s.name,
        s.nameArabic || '',
        s.creditHours || '',
        s.description || '',
      ].join(',')),
    ].join('\n');

    const fileName = `template-mata-pelajaran-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('Download subjects template error:', error);
    return new NextResponse('Failed to download template', { status: 500 });
  }
}
