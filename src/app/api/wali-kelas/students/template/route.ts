import { NextRequest, NextResponse } from 'next/server';
import { requireWaliKelasAdminPrincipal } from '@/lib/auth/role-access';
import * as XLSX from 'xlsx';
import { serverError } from '@/lib/server-log';

async function verifyWaliKelas(req: NextRequest) {
  return requireWaliKelasAdminPrincipal(req);
}

export async function GET(request: NextRequest) {
  try {
    // Verify user
    const user = await verifyWaliKelas(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create sample data
    const sampleData = [
      {
        'Nomor Induk': 'STD001',
        Nama: 'Contoh: Ahmad Riyandi',
        'No Urut': 1,
        'Jenis Kelamin': 'Laki-laki',
        Email: 'ahmad@email.com',
        Telepon: '082123456789',
        Alamat: 'Jl. Contoh No. 123',
        'Tanggal Lahir': '2010-01-15',
        'Telp Wali Murid': '082198765432',
      },
      {
        'Nomor Induk': 'STD002',
        Nama: 'Contoh: Siti Nur Azizah',
        'No Urut': 2,
        'Jenis Kelamin': 'Perempuan',
        Email: 'siti@email.com',
        Telepon: '082223456789',
        Alamat: 'Jl. Pendidikan No. 456',
        'Tanggal Lahir': '2010-03-20',
        'Telp Wali Murid': '082298765433',
      },
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(sampleData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // Nomor Induk
      { wch: 25 }, // Nama
      { wch: 10 }, // No Urut
      { wch: 15 }, // Jenis Kelamin
      { wch: 20 }, // Email
      { wch: 15 }, // Telepon
      { wch: 30 }, // Alamat
      { wch: 15 }, // Tanggal Lahir
      { wch: 15 }, // Telp Wali Murid
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Siswa');

    // Generate Excel file
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Return file response
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `template-siswa-${timestamp}.xlsx`;

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
