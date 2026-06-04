import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMenuAccess } from '@/lib/auth/verify-access';
import * as XLSX from 'xlsx';
import { serverError } from '@/lib/server-log';

async function requireUserTemplateAccess(req: NextRequest) {
  return requireMenuAccess(req, '/admin/users', ['ADMIN']);
}

/**
 * GET /api/admin/users/template
 * Download template for users import
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUserTemplateAccess(request);
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const schools = await prisma.school.findMany({
      select: { name: true },
      take: 5,
    });

    // Create template data
    const templateData = [
      {
        'Email': 'contoh@email.com',
        'Nama': 'Nama Pengguna Contoh',
        'Password': 'Password Aman',
        'Role': 'TEACHER',
        'Sekolah': schools.length > 0 ? schools[0].name : 'Nama Sekolah',
        'Bagian': 'PENGASUHAN, MABIKORI',
        'Status': 'AKTIF',
      },
      {
        'Email': 'guru2@email.com',
        'Nama': 'Nama Guru Kedua',
        'Password': 'Password123',
        'Role': 'TEACHER',
        'Sekolah': schools.length > 0 ? schools[0].name : 'Nama Sekolah',
        'Bagian': 'EKSKUL',
        'Status': 'AKTIF',
      },
    ];

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');

    // Set column widths
    ws['!cols'] = [
      { wch: 25 },
      { wch: 25 },
      { wch: 20 },
      { wch: 15 },
      { wch: 25 },
      { wch: 30 },
      { wch: 10 },
    ];

    // Create a second sheet for instructions
    const instructionData = [
      ['PANDUAN IMPOR DATA PENGGUNA'],
      [''],
      ['Kolom yang Wajib Diisi:'],
      ['1. Email - Alamat email yang unik'],
      ['2. Nama - Nama lengkap pengguna'],
      ['3. Password - Password minimal 8 karakter (hanya untuk user baru)'],
      [''],
      ['Kolom Opsional:'],
      ['1. Role - TEACHER, ADMIN, PRINCIPAL, WALI_KELAS (default: TEACHER)'],
      ['2. Sekolah - Nama sekolah yang sudah terdaftar'],
      ['3. Bagian - Pisahkan dengan koma. Nilai: PENGASUHAN, MABIKORI, PUSDAC, LAC, EKSKUL'],
      ['4. Status - AKTIF atau NONAKTIF (default: AKTIF)'],
      [''],
      ['Catatan:'],
      ['- Jangan menghapus baris header (Email, Nama, Password, Role, Sekolah, Bagian, Status)'],
      ['- Email harus unik, jika email sudah terdaftar akan diupdate'],
      ['- Gunakan nama sekolah yang sama persis dengan yang terdaftar'],
      ['- Kolom dapat bebas urutan, tapi nama harus sesuai'],
      ['- Bagian bisa diisi lebih dari satu, pisahkan dengan koma (contoh: PENGASUHAN, LAC)'],
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionData);
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Panduan');

    // Generate buffer
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    const fileName = `template-users-${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: unknown) {
    serverError('Download users template error:', error);
    return new NextResponse('Failed to download template', { status: 500 });
  }
}
