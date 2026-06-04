import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ensureClassOwnedByWaliKelasOrAllowed, requireClassSubjectAccess } from '@/lib/auth/class-access';
import * as XLSX from 'xlsx';
import { serverError } from '@/lib/server-log';


/**
 * GET /api/admin/classes/[id]/subjects/template
 * Download template for subjects import
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

    // Create template data
    const templateData = [
      {
        'Kode': 'MTH01',
        'Nama': 'Matematika',
        'Nama Arab': 'الرياضيات',
        'Jam Kredit': 4,
        'Deskripsi': 'Pelajaran Matematika',
      },
      ...subjects.map(s => ({
        'Kode': s.code,
        'Nama': s.name,
        'Nama Arab': s.nameArabic || '',
        'Jam Kredit': s.creditHours || '',
        'Deskripsi': s.description || '',
      })),
    ];

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(templateData);
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

    // Create a second sheet for instructions
    const instructionData = [
      ['PANDUAN IMPOR DATA MATA PELAJARAN'],
      [''],
      ['Kolom yang Wajib Diisi:'],
      ['1. Kode - Kode unik untuk mata pelajaran'],
      ['2. Nama - Nama lengkap mata pelajaran'],
      [''],
      ['Kolom Opsional:'],
      ['1. Nama Arab - Nama mata pelajaran dalam bahasa Arab'],
      ['2. Jam Kredit - Jumlah jam pelajaran (angka)'],
      ['3. Deskripsi - Deskripsi singkat mata pelajaran'],
      [''],
      ['Catatan:'],
      ['- Jangan menghapus baris header'],
      ['- Kode harus unik untuk setiap mata pelajaran'],
      ['- Gunakan format Excel (.xlsx) untuk impor'],
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionData);
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Panduan');

    // Generate buffer
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    const fileName = `template-mata-pelajaran-${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: unknown) {
    serverError('Download subjects template error:', error);
    return new NextResponse('Failed to download template', { status: 500 });
  }
}
