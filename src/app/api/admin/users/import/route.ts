import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db';
import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';

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
 * POST /api/admin/users/import
 * Import users from Excel file
 */
export async function POST(request: NextRequest) {
  let user: any;
  try {
    user = await verifyAdmin(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Read Excel file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'File Excel kosong' },
        { status: 400 }
      );
    }

    const results = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Get all schools for validation
    const schools = await prisma.school.findMany();
    const roleMap: Record<string, string> = {
      'ADMIN': 'ADMIN',
      'TEACHER': 'TEACHER',
      'GURU': 'TEACHER',
      'PRINCIPAL': 'PRINCIPAL',
      'KEPALA SEKOLAH': 'PRINCIPAL',
      'WALI_KELAS': 'WALI_KELAS',
      'WALI KELAS': 'WALI_KELAS',
      'ADMINISTRATOR': 'ADMIN',
    };

    // Function to get value from row with flexible column name matching
    function getRowValue(row: any, ...possibleKeys: string[]): string {
      for (const key of possibleKeys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          return row[key].toString().trim();
        }
      }
      return '';
    }

    for (let i = 0; i < data.length; i++) {
      const row = data[i] as any;

      try {
        // Skip empty rows
        if (!row || Object.keys(row).length === 0) {
          continue;
        }

        // Validate required fields with flexible column name matching
        const email = getRowValue(row, 'Email', 'EMAIL', 'email', 'E-mail', 'e-mail');
        const name = getRowValue(row, 'Nama', 'NAMA', 'nama', 'Nama Lengkap', 'nama lengkap', 'Name');
        const password = getRowValue(row, 'Password', 'PASSWORD', 'password', 'Pass');
        let role = getRowValue(row, 'Role', 'ROLE', 'role').toUpperCase();
        const schoolName = getRowValue(row, 'Sekolah', 'SEKOLAH', 'sekolah', 'School', 'Nama Sekolah');
        const status = getRowValue(row, 'Status', 'STATUS', 'status')?.toUpperCase();

        if (!email || !name) {
          results.errors.push(`Baris ${i + 2}: Email dan Nama harus diisi`);
          results.skipped++;
          continue;
        }

        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
          results.errors.push(`Baris ${i + 2}: Email "${email}" tidak valid`);
          results.skipped++;
          continue;
        }

        // Map role - use the flexible role value
        role = roleMap[role] || 'TEACHER';

        // Find school - handle flexible school name matching
        const school = schools.find(
          (s) => s.name.toLowerCase() === schoolName?.toLowerCase()
        );

        if (!school) {
          if (schoolName) {
            results.errors.push(
              `Baris ${i + 2}: Sekolah "${schoolName}" tidak ditemukan`
            );
          } else {
            results.errors.push(
              `Baris ${i + 2}: Kolom Sekolah harus diisi`
            );
          }
          results.skipped++;
          continue;
        }

        const isActive = status === 'AKTIF' || status === 'true' || status === '1' || status === 'TRUE';

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          // Update existing user
          await prisma.user.update({
            where: { email },
            data: {
              name,
              role: role as any,
              schoolId: school.id,
              isActive,
              ...(password && { password: await bcrypt.hash(password, 10) }),
            },
          });
          results.updated++;
        } else {
          // Create new user
          if (!password) {
            results.errors.push(
              `Baris ${i + 2}: Password harus diisi untuk user baru`
            );
            results.skipped++;
            continue;
          }

          await prisma.user.create({
            data: {
              email,
              name,
              password: await bcrypt.hash(password, 10),
              role: role as any,
              schoolId: school.id,
              isActive,
            },
          });
          results.imported++;
        }
      } catch (error: any) {
        results.errors.push(`Baris ${i + 2}: ${error.message}`);
        results.skipped++;
      }
    }

    await logActivity({
      userId: user.id,
      action: 'IMPORT',
      resourceType: 'User',
      resourceId: '',
      resourceName: `Imported ${results.imported} users, updated ${results.updated}`,
      description: 'Imported users from Excel file',
      newValue: results,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return NextResponse.json(
      { success: true, data: results },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Import users error:', error);
    if (user) {
      await logActivity({
        userId: user.id,
        action: 'IMPORT',
        resourceType: 'User',
        resourceId: '',
        description: 'Failed to import users',
        errorMessage: error?.message || 'Unknown error',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
      });
    }
    return NextResponse.json(
      { error: 'Failed to import users' },
      { status: 500 }
    );
  }
}
