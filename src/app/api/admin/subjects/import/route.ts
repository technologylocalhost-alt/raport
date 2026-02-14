import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';
import * as XLSX from 'xlsx';

interface ImportRow {
  [key: string]: any;
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
  }, {} as Record<string, any>);

  console.log('[Normalize Row] Column map:', Object.keys(columnMap));

  // Map various possible column names to our standard properties
  normalized.jenjang = columnMap['jenjang'] || columnMap['level'] || columnMap['level'];
  normalized.kode = columnMap['kode'] || columnMap['code'] || columnMap['matapelajarankode'];
  normalized.nama = columnMap['nama'] || columnMap['name'] || columnMap['matapelajarannama'];
  normalized.namaArab = columnMap['namaarab'] || columnMap['namearabic'] || columnMap['arabicname'];
  normalized.deskripsi = columnMap['deskripsi'] || columnMap['description'];
  
  // Parse credit hours as number
  const creditValue = columnMap['jamkredit'] || columnMap['credithours'] || columnMap['credits'];
  normalized.jamKredit = creditValue ? parseInt(creditValue.toString()) : undefined;

  console.log('[Normalize Row] Result:', normalized);
  
  return normalized;
}

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

  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL')) {
    return user;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin
    const user = await verifyAdmin(request);
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
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows: ImportRow[] = XLSX.utils.sheet_to_json(worksheet);

    console.log('[Import] Raw rows from Excel:', rawRows.length);
    if (rawRows.length > 0) {
      console.log('[Import] First row keys:', Object.keys(rawRows[0]));
      console.log('[Import] First row values:', rawRows[0]);
    }

    // Normalize all rows
    const rows: NormalizedRow[] = rawRows.map((row, idx) => {
      try {
        return normalizeRow(row);
      } catch (error) {
        console.error(`[Import] Error normalizing row ${idx + 2}:`, error);
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
        console.log(`[Import] Processing row ${rowNumber}:`, row);

        // Trim all string fields
        const jenjang = row.jenjang?.toString().trim() || '';
        const kode = row.kode?.toString().trim() || '';
        const nama = row.nama?.toString().trim() || '';
        const namaArab = row.namaArab?.toString().trim() || '';
        const deskripsi = row.deskripsi?.toString().trim() || '';

        console.log(`[Import] Row ${rowNumber} trimmed values:`, { jenjang, kode, nama });

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

    return NextResponse.json(
      {
        success: true,
        message: `Import selesai. Berhasil: ${results.success}, Gagal: ${results.failed}, Duplikat: ${results.duplicates}`,
        data: results,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      {
        error: 'Terjadi kesalahan saat mengimpor file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
