import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';
import * as XLSX from 'xlsx';

async function verifyWaliKelas(req: NextRequest) {
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

  if (user && (user.role === 'WALI_KELAS' || user.role === 'ADMIN' || user.role === 'PRINCIPAL')) {
    return user;
  }
  return null;
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
        Email: 'ahmad@email.com',
        Telepon: '082123456789',
        Alamat: 'Jl. Contoh No. 123',
        'Tanggal Lahir': '2010-01-15',
        'Telp Wali Murid': '082198765432',
      },
      {
        'Nomor Induk': 'STD002',
        Nama: 'Contoh: Siti Nur Azizah',
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
    console.error('Template export error:', error);
    return NextResponse.json(
      {
        error: 'Terjadi kesalahan saat mengekspor template',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
