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

    // Get classId from query
    const searchParams = request.nextUrl.searchParams;
    const classId = searchParams.get('classId');

    if (!classId) {
      return NextResponse.json({ error: 'Class ID tidak ditemukan' }, { status: 400 });
    }

    // Verify class exists
    const classData = await prisma.class.findFirst({
      where: {
        id: classId,
        school: { id: user.schoolId },
      },
    });

    if (!classData) {
      return NextResponse.json(
        { error: 'Kelas tidak ditemukan atau Anda tidak memiliki akses' },
        { status: 403 }
      );
    }

    // Get students for this class
    const students = await prisma.student.findMany({
      where: { classId },
      orderBy: { studentNo: 'asc' },
    });

    // Map to export format
    const exportData = students.map((student) => ({
      'Nomor Induk': student.studentNo,
      Nama: student.name,
      Email: student.email || '',
      Telepon: student.phone || '',
      Alamat: student.address || '',
      'Tanggal Lahir': student.birthDate
        ? student.birthDate.toISOString().split('T')[0]
        : '',
      'Telp Wali Murid': student.parentPhoneNo || '',
    }));

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);

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
    const filename = `siswa-${classData.name}-${timestamp}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      {
        error: 'Terjadi kesalahan saat mengekspor file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
