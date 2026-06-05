import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminOrPrincipal } from '@/lib/auth/admin-access';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import * as XLSX from 'xlsx';
import { serverError } from '@/lib/server-log';

interface ImportRow {
  [key: string]: unknown;
}

interface NormalizedRow {
  jenjang?: string;
  kode?: string;
  nama?: string;
  namaArab?: string;
  deskripsi?: string;
  jamKredit?: number;
}

// Helper function to normalize column names (convert to lowercase and remove spaces)
function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '');
}

// Helper function to normalize row data - map flexible column names to standard properties
function normalizeRow(row: ImportRow): NormalizedRow {
  const normalized: NormalizedRow = {};
  
  // Create a map for case-insensitive column lookup
  const columnMap = Object.keys(row).reduce((acc, key) => {
    acc[normalizeColumnName(key)] = row[key];
    return acc;
  }, {} as Record<string, unknown>);


  // Map various possible column names to our standard properties
  normalized.jenjang = columnMap['jenjang'] ? String(columnMap['jenjang']) : columnMap['level'] ? String(columnMap['level']) : undefined;
  normalized.kode = columnMap['kode'] ? String(columnMap['kode']) : columnMap['code'] ? String(columnMap['code']) : columnMap['matapelajarankode'] ? String(columnMap['matapelajarankode']) : undefined;
  normalized.nama = columnMap['nama'] ? String(columnMap['nama']) : columnMap['name'] ? String(columnMap['name']) : columnMap['matapelajarannama'] ? String(columnMap['matapelajarannama']) : undefined;
  normalized.namaArab = columnMap['namaarab'] ? String(columnMap['namaarab']) : columnMap['namearabic'] ? String(columnMap['namearabic']) : columnMap['arabicname'] ? String(columnMap['arabicname']) : undefined;
  normalized.deskripsi = columnMap['deskripsi'] ? String(columnMap['deskripsi']) : columnMap['description'] ? String(columnMap['description']) : undefined;
  
  // Parse credit hours as number
  const creditValue = columnMap['jamkredit'] || columnMap['credithours'] || columnMap['credits'];
  normalized.jamKredit = creditValue ? parseInt(creditValue.toString()) : undefined;

  
  return normalized;
}


export async function POST(request: NextRequest) {
  try {
    // Verify admin
    const user = await requireAdminOrPrincipal(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'File tidak ditemukan' },
        { status: 400 }
      );
    }

    // Read file as buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows: ImportRow[] = XLSX.utils.sheet_to_json(worksheet);


    // Normalize all rows
    const rows: NormalizedRow[] = rawRows.map((row, idx) => {
      try {
        return normalizeRow(row);
      } catch (error) {
        serverError(`[Import] Error normalizing row ${idx + 2}:`, error);
        return {};
      }
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'File Excel kosong' },
        { status: 400 }
      );
    }

    // Map level names to IDs and validate
    const levelMap = new Map<string, string>();
    const distinctLevels = [...new Set(rows.map((r) => r.jenjang?.trim()).filter(Boolean))];

    for (const levelName of distinctLevels) {
      if (!levelName) continue;
      
      const level = await prisma.level.findFirst({
        where: {
          name: {
            equals: levelName,
            mode: 'insensitive',
          },
        },
      });

      if (!level) {
        return NextResponse.json(
          {
            error: `Jenjang "${levelName}" tidak ditemukan di database`,
            details: `Pastikan jenjang yang Anda gunakan sudah terdaftar di sistem`,
          },
          { status: 400 }
        );
      }
      levelMap.set(levelName, level.id);
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
      const rowNumber = i + 2; // +1 for header, +1 for 1-based indexing

      try {

        // Trim all string fields
        const jenjang = row.jenjang?.toString().trim() || '';
        const kode = row.kode?.toString().trim() || '';
        const nama = row.nama?.toString().trim() || '';
        const namaArab = row.namaArab?.toString().trim() || '';
        const deskripsi = row.deskripsi?.toString().trim() || '';


        // Validate required fields
        if (!jenjang) {
          results.errors.push({ row: rowNumber, message: 'Jenjang wajib diisi' });
          results.failed++;
          continue;
        }

        if (!kode) {
          results.errors.push({ row: rowNumber, message: 'Kode wajib diisi' });
          results.failed++;
          continue;
        }

        if (!nama) {
          results.errors.push({ row: rowNumber, message: 'Nama wajib diisi' });
          results.failed++;
          continue;
        }

        const levelId = levelMap.get(jenjang);
        if (!levelId) {
          results.errors.push({ row: rowNumber, message: `Jenjang "${jenjang}" tidak valid` });
          results.failed++;
          continue;
        }

        // Check if subject already exists
        const existingSubject = await prisma.subject.findFirst({
          where: {
            AND: [
              { code: { equals: kode, mode: 'insensitive' } },
              { levelId },
            ],
          },
        });

        if (existingSubject) {
          results.errors.push({
            row: rowNumber,
            message: `Kode "${kode}" sudah ada untuk jenjang ini`,
          });
          results.duplicates++;
          continue;
        }

        // Create subject
        await prisma.subject.create({
          data: {
            code: kode,
            name: nama,
            nameArabic: namaArab || null,
            description: deskripsi || null,
            creditHours: row.jamKredit ? parseInt(row.jamKredit.toString()) : null,
            levelId,
          },
        });

        results.success++;
      } catch (error) {
        results.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Error tidak diketahui',
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
      resourceType: 'Subject',
      resourceId: `bulk_${Date.now()}`,
      description: `Imported ${results.success} subjects from file (${results.failed} failed, ${results.duplicates} duplicates)`,
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
    const verifyUser = await requireAdminOrPrincipal(request);
    if (verifyUser) {
      const ipAddress = getClientIp(request);
      const userAgent = getUserAgent(request);
      
      await logActivity({
        userId: verifyUser.id,
        action: 'IMPORT',
        resourceType: 'Subject',
        description: 'Failed to import subjects from file',
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ipAddress,
        userAgent,
      });
    }

    serverError('Import error:', error);
    return NextResponse.json(
      {
        error: 'Terjadi kesalahan saat mengimpor file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
