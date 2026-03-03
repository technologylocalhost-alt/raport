import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db';
import * as XLSX from 'xlsx';

async function verifyAdmin(req: NextRequest) {
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

  if (user && user.role === 'ADMIN') {
    return user;
  }
  return null;
}

/**
 * GET /api/admin/users/export
 * Export users as Excel
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const users = await prisma.user.findMany({
      include: {
        school: {
          select: { name: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const roleLabels: Record<string, string> = {
      ADMIN: 'Administrator',
      TEACHER: 'Guru',
      PRINCIPAL: 'Kepala Sekolah',
      WALI_KELAS: 'Wali Kelas',
    };

    // Transform data for export
    const exportData = users.map((u) => ({
      'Email': u.email,
      'Nama': u.name,
      'Role': roleLabels[u.role] || u.role,
      'Sekolah': u.school?.name || '-',
      'Status': u.isActive ? 'AKTIF' : 'NONAKTIF',
      'Dibuat': new Date(u.createdAt).toLocaleDateString('id-ID'),
    }));

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');

    // Set column widths
    ws['!cols'] = [
      { wch: 25 },
      { wch: 25 },
      { wch: 15 },
      { wch: 25 },
      { wch: 12 },
      { wch: 15 },
    ];

    // Generate buffer
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    const fileName = `users-${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('Export users error:', error);
    return new NextResponse('Failed to export users', { status: 500 });
  }
}
