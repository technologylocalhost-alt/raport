import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ensureClassOwnedByWaliKelasOrAllowed, requireClassSubjectAccess } from '@/lib/auth/class-access';
import * as XLSX from 'xlsx';
import { serverError } from '@/lib/server-log';


/**
 * GET /api/admin/classes/[id]/teachers/export
 * Export teachers as Excel
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

    // Create export data
    const exportData = teachers.map(ct => ({
      'Nama Guru': ct.teacher.name,
      'Email': ct.teacher.email,
      'Kode Mata Pelajaran': ct.subject.code,
      'Mata Pelajaran': ct.subject.name,
    }));

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Guru Pengajar');

    // Set column widths
    ws['!cols'] = [
      { wch: 25 },
      { wch: 25 },
      { wch: 20 },
      { wch: 25 },
    ];

    // Generate buffer
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    const fileName = `guru-pengajar-${classData.name}-${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: unknown) {
    serverError('Export teachers error:', error);
    return new NextResponse('Failed to export teachers', { status: 500 });
  }
}
