import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminOrPrincipal } from '@/lib/auth/admin-access';
import * as XLSX from 'xlsx';
import { serverError } from '@/lib/server-log';

async function requireSubjectTemplateAccess(req: NextRequest) {
  return requireAdminOrPrincipal(req);
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin
    const user = await requireSubjectTemplateAccess(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all levels for example data
    const levels = await prisma.level.findMany();
    if (levels.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada jenjang di database. Silakan buat jenjang terlebih dahulu.' },
        { status: 400 }
      );
    }

    // Create sample data with all levels
    const sampleData = [
      {
        Jenjang: levels[0]?.name || 'SD',
        Kode: 'MTK',
        Nama: 'Contoh: Matematika',
        'Nama Arab': 'الرياضيات',
        Deskripsi: 'Pelajaran matematika dasar',
        'Jam Kredit': 4,
      },
      {
        Jenjang: levels[0]?.name || 'SD',
        Kode: 'BIN',
        Nama: 'Contoh: Bahasa Indonesia',
        'Nama Arab': 'اللغة الإندونيسية',
        Deskripsi: 'Pelajaran bahasa Indonesia',
        'Jam Kredit': 4,
      },
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(sampleData);

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
    const filename = `mata-pelajaran-template-${timestamp}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    serverError('Template export error:', error);
    return NextResponse.json(
      {
        error: 'Terjadi kesalahan saat mengekspor template',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
