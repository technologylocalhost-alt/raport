import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ensureClassOwnedByWaliKelasOrAllowed, requireClassSubjectAccess } from '@/lib/auth/class-access';
import * as XLSX from 'xlsx';
import { serverError } from '@/lib/server-log';


/**
 * GET /api/admin/classes/[id]/subjects/export
 * Export subjects as Excel
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireClassSubjectAccess(request);
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = await params;
    const access = await ensureClassOwnedByWaliKelasOrAllowed(user, id);

    if (!access.ok) {
      return new NextResponse(access.reason === 'NOT_FOUND' ? 'Class not found' : 'Unauthorized', {
        status: access.reason === 'NOT_FOUND' ? 404 : 403,
      });
    }

    const { classData } = access;

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
  } catch (error: unknown) {
    serverError('Export subjects error:', error);
    return new NextResponse('Failed to export subjects', { status: 500 });
  }
}
