import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminOrPrincipal } from '@/lib/auth/admin-access';
import * as XLSX from 'xlsx';
import { serverError } from '@/lib/server-log';

async function requireSubjectExportAccess(req: NextRequest) {
  return requireAdminOrPrincipal(req);
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin
    const user = await requireSubjectExportAccess(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all subjects with level info
    const subjects = await prisma.subject.findMany({
      include: {
        level: true,
      },
      orderBy: [
        { level: { name: 'asc' } },
        { code: 'asc' },
      ],
    });

    // Map to export format
    const exportData = subjects.map((subject) => ({
      Jenjang: subject.level?.name || 'N/A',
      Kode: subject.code,
      Nama: subject.name,
      'Nama Arab': subject.nameArabic || '',
      Deskripsi: subject.description || '',
      'Jam Kredit': subject.creditHours || '',
    }));

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 18 }, // Jenjang
      { wch: 12 }, // Kode
      { wch: 25 }, // Nama
      { wch: 25 }, // Nama Arab
      { wch: 30 }, // Deskripsi
      { wch: 12 }, // Jam Kredit
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mata Pelajaran');

    // Generate Excel file
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Return file response
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `mata-pelajaran-export-${timestamp}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    serverError('Export error:', error);
    return NextResponse.json(
      {
        error: 'Terjadi kesalahan saat mengekspor file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
