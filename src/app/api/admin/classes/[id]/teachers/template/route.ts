import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ensureClassOwnedByWaliKelasOrAllowed, requireClassSubjectAccess } from '@/lib/auth/class-access';
import * as XLSX from 'xlsx';
import { serverError } from '@/lib/server-log';


/**
 * GET /api/admin/classes/[id]/teachers/template
 * Download template for teachers import
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

    // Get example teachers and subjects
    const teachers = await prisma.user.findMany({
      where: {
        role: 'TEACHER',
      },
      select: {
        name: true,
        email: true,
      },
      take: 3,
    });

    const subjects = await prisma.subject.findMany({
      select: {
        code: true,
        name: true,
      },
      take: 3,
    });

    // Create template data
    const templateData = [];
    
    // Add example row
    templateData.push({
      'Nama Guru': 'Nama Guru Contoh',
      'Email': 'guru@example.com',
      'Kode Mata Pelajaran': 'SUBJ01',
      'Mata Pelajaran': 'Mata Pelajaran Contoh',
    });

    // Add example data from database
    if (teachers.length > 0 && subjects.length > 0) {
      teachers.forEach((teacher, idx) => {
        const subject = subjects[idx % subjects.length];
        templateData.push({
          'Nama Guru': teacher.name,
          'Email': teacher.email,
          'Kode Mata Pelajaran': subject.code,
          'Mata Pelajaran': subject.name,
        });
      });
    }

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Guru Pengajar');

    // Set column widths
    ws['!cols'] = [
      { wch: 25 },
      { wch: 25 },
      { wch: 20 },
      { wch: 25 },
    ];

    // Create a second sheet for instructions
    const instructionData = [
      ['PANDUAN IMPOR DATA GURU PENGAJAR'],
      [''],
      ['Kolom yang Wajib Diisi:'],
      ['1. Email - Email guru yang sudah terdaftar di sistem'],
      ['2. Kode Mata Pelajaran - Kode mata pelajaran yang sudah ada di kelas ini'],
      [''],
      ['Kolom Opsional:'],
      ['1. Nama Guru - Nama lengkap guru'],
      ['2. Mata Pelajaran - Nama mata pelajaran'],
      [''],
      ['Catatan:'],
      ['- Jangan menghapus baris header'],
      ['- Email harus sesuai dengan data guru yang terdaftar'],
      ['- Mata pelajaran harus sudah ditambahkan ke kelas sebelumnya'],
      ['- Gunakan format Excel (.xlsx) untuk impor'],
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionData);
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Panduan');

    // Generate buffer
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    const fileName = `template-guru-pengajar-${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: unknown) {
    serverError('Download teachers template error:', error);
    return new NextResponse('Failed to download template', { status: 500 });
  }
}
