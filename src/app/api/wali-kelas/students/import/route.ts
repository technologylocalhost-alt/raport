import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireWaliKelasAdminPrincipal } from '@/lib/auth/role-access';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import * as XLSX from 'xlsx';
import { serverError } from '@/lib/server-log';

interface ImportRow {
  [key: string]: unknown;
}

interface NormalizedRow {
  studentNo?: string;
  name?: string;
  nourut?: number | string;
  gender?: string;
  email?: string;
  phone?: string;
  address?: string;
  birthDate?: string;
  parentPhoneNo?: string;
}

// Helper function to normalize column names
function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '');
}

// Helper function to normalize row data
function normalizeRow(row: ImportRow): NormalizedRow {
  const normalized: NormalizedRow = {};
  
  const columnMap = Object.keys(row).reduce((acc, key) => {
    acc[normalizeColumnName(key)] = row[key];
    return acc;
  }, {} as Record<string, unknown>);

  normalized.studentNo = columnMap['nomorinduk'] ? String(columnMap['nomorinduk']) : columnMap['studentno'] ? String(columnMap['studentno']) : columnMap['nomor'] ? String(columnMap['nomor']) : undefined;
  normalized.name = columnMap['nama'] ? String(columnMap['nama']) : columnMap['name'] ? String(columnMap['name']) : undefined;
  const nourutValue = columnMap['nourut'] ?? columnMap['nomourut'] ?? columnMap['urut'];
  if (typeof nourutValue === 'string' || typeof nourutValue === 'number') {
    normalized.nourut = nourutValue;
  }
  normalized.gender = columnMap['jeniskelamin'] ? String(columnMap['jeniskelamin']) : columnMap['gender'] ? String(columnMap['gender']) : 'MALE';
  normalized.email = columnMap['email'] ? String(columnMap['email']) : columnMap['surel'] ? String(columnMap['surel']) : undefined;
  normalized.phone = columnMap['telepon'] ? String(columnMap['telepon']) : columnMap['phone'] ? String(columnMap['phone']) : columnMap['notelepon'] ? String(columnMap['notelepon']) : undefined;
  normalized.address = columnMap['alamat'] ? String(columnMap['alamat']) : columnMap['address'] ? String(columnMap['address']) : undefined;
  normalized.birthDate = columnMap['tanggallahir'] ? String(columnMap['tanggallahir']) : columnMap['birthdate'] ? String(columnMap['birthdate']) : columnMap['dob'] ? String(columnMap['dob']) : undefined;
  normalized.parentPhoneNo = columnMap['telpwalimurid'] ? String(columnMap['telpwalimurid']) : columnMap['parentphone'] ? String(columnMap['parentphone']) : columnMap['phonewalimurid'] ? String(columnMap['phonewalimurid']) : undefined;

  return normalized;
}

async function verifyWaliKelas(req: NextRequest) {
  return requireWaliKelasAdminPrincipal(req);
}

export async function POST(request: NextRequest) {
  try {
    // Verify user
    const user = await verifyWaliKelas(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const classId = formData.get('classId') as string;

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
    }

    if (!classId) {
      return NextResponse.json({ error: 'Class ID tidak ditemukan' }, { status: 400 });
    }

    // Verify class exists and user has access
    const classData = await prisma.class.findFirst({
      where: {
        id: classId,
        level: { schoolId: user.schoolId },
      },
      include: { level: true },
    });

    if (!classData) {
      return NextResponse.json(
        { error: 'Kelas tidak ditemukan atau Anda tidak memiliki akses' },
        { status: 403 }
      );
    }

    // Read and parse Excel
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows: ImportRow[] = XLSX.utils.sheet_to_json(worksheet);

    if (rawRows.length > 0) {
    }

    // Normalize rows
    const rows: NormalizedRow[] = rawRows.map((row) => normalizeRow(row));

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File Excel kosong' }, { status: 400 });
    }

    // Process and insert data
    const results = {
      success: 0,
      failed: 0,
      duplicates: 0,
      errors: [] as { row: number; message: string }[],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      try {
        // Trim values
        const studentNo = row.studentNo?.toString().trim() || '';
        const name = row.name?.toString().trim() || '';
        const nourut = row.nourut ? parseInt(row.nourut.toString().trim()) : null;
        let gender = row.gender?.toString().trim() || 'MALE';
        // Normalize gender values - handle both English and Indonesian formats
        const genderLower = gender.toLowerCase();
        if (genderLower === 'perempuan' || gender === 'FEMALE') {
          gender = 'FEMALE';
        } else if (genderLower === 'laki-laki' || gender === 'MALE' || gender.toUpperCase() === 'MALE') {
          gender = 'MALE';
        } else {
          gender = 'MALE'; // Default to MALE if unclear
        }
        const email = row.email?.toString().trim() || '';
        const phone = row.phone?.toString().trim() || '';
        const address = row.address?.toString().trim() || '';
        const birthDateStr = row.birthDate?.toString().trim() || '';
        const parentPhoneNo = row.parentPhoneNo?.toString().trim() || '';


        // Validate required fields
        if (!studentNo) {
          results.errors.push({ row: rowNumber, message: 'Nomor Induk wajib diisi' });
          results.failed++;
          continue;
        }

        if (!name) {
          results.errors.push({ row: rowNumber, message: 'Nama wajib diisi' });
          results.failed++;
          continue;
        }

        // Check for duplicates
        const existingStudent = await prisma.student.findFirst({
          where: {
            AND: [{ studentNo: { equals: studentNo, mode: 'insensitive' } }, { classId }],
          },
        });

        if (existingStudent) {
          results.errors.push({
            row: rowNumber,
            message: `Nomor Induk "${studentNo}" sudah ada di kelas ini`,
          });
          results.duplicates++;
          continue;
        }

        // Parse birth date
        let birthDate: Date | null = null;
        if (birthDateStr) {
          try {
            birthDate = new Date(birthDateStr);
            if (isNaN(birthDate.getTime())) {
              birthDate = null;
            }
          } catch {
            serverError(`[Import Students] Invalid date for row ${rowNumber}:`, birthDateStr);
            birthDate = null;
          }
        }

        // Create student
        await prisma.student.create({
          data: {
            studentNo,
            name,
            nourut: nourut || null,
            email: email || null,
            phone: phone || null,
            address: address || null,
            birthDate,
            parentPhoneNo: parentPhoneNo || null,
            classId,
            gender: gender === 'FEMALE' ? 'FEMALE' : 'MALE',
          },
        });

        results.success++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error tidak diketahui';
        serverError(`[Import Students] Row ${rowNumber} error:`, errorMessage);
        results.errors.push({
          row: rowNumber,
          message: errorMessage,
        });
        results.failed++;
      }
    }

    // Log successful import
    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);
    
    await logActivity({
      userId: user.id,
      action: 'IMPORT',
      resourceType: 'Student',
      resourceId: `bulk_${Date.now()}`,
      description: `Imported ${results.success} students to class ${classData.id} (${results.failed} failed, ${results.duplicates} duplicates)`,
      status: 'SUCCESS',
      ipAddress,
      userAgent,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Import selesai. Berhasil: ${results.success}, Gagal: ${results.failed}, Duplikat: ${results.duplicates}`,
        data: results,
      },
      { status: 200 }
    );
  } catch (error) {
    // Log failed import
    const user = await verifyWaliKelas(request);
    if (user) {
      const ipAddress = getClientIp(request);
      const userAgent = getUserAgent(request);
      
      await logActivity({
        userId: user.id,
        action: 'IMPORT',
        resourceType: 'Student',
        description: 'Failed to import students from file',
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ipAddress,
        userAgent,
      });
    }
    
    serverError('[Import Students] Fatal error:', error);
    return NextResponse.json(
      {
        error: 'Terjadi kesalahan saat mengimpor file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
