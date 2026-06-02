import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';
import * as XLSX from 'xlsx';

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
 * GET /api/admin/classes/[id]/subjects/export
 * Export subjects as Excel
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

    const subjects = await prisma.classSubject.findMany({
      where: { classId: id },
      include: {
        subject: {
          select: {
            code: true,
            name: true,
            nameArabic: true,
            creditHours: true,
            description: true,
          },
        },
      },
      orderBy: { subject: { code: 'asc' } },
    });

    // Create export data
    const exportData = subjects.map(cs => ({
      'Kode': cs.subject.code,
      'Nama': cs.subject.name,
      'Nama Arab': cs.subject.nameArabic || '',
      'Jam Kredit': cs.subject.creditHours || '',
      'Deskripsi': cs.subject.description || '',
    }));

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mata Pelajaran');

    // Set column widths
    ws['!cols'] = [
      { wch: 12 },
      { wch: 25 },
      { wch: 25 },
      { wch: 12 },
      { wch: 30 },
    ];

    // Generate buffer
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    const fileName = `mata-pelajaran-${classData.name}-${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('Export subjects error:', error);
    return new NextResponse('Failed to export subjects', { status: 500 });
  }
}
