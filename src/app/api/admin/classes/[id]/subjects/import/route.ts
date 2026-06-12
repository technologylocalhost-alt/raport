import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import {
  ensureClassOwnedByWaliKelasOrAllowed,
  requireClassSubjectAccess,
  requireEditableClassByPeriod,
} from '@/lib/auth/class-access';
import { AuthenticatedUser } from '@/lib/auth/access';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import * as XLSX from 'xlsx';
import { serverError } from '@/lib/server-log';

// Helper function to parse CSV row properly (handle quoted fields)
function parseCSVRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    const nextChar = row[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

// Helper function to normalize column names
function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '');
}

// Helper function to parse Excel file and return array of rows
async function parseExcelFile(
  file: File
): Promise<{ data: Record<string, unknown>[], headers: string[] }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

  const headers = Object.keys(data[0] || {}).map(h => normalizeColumnName(h));

  return { data, headers };
}


/**
 * POST /api/admin/classes/[id]/subjects/import
 * Import subjects from Excel or CSV
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user: AuthenticatedUser | null = null;
  try {
    user = await requireClassSubjectAccess(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    const access = await ensureClassOwnedByWaliKelasOrAllowed(user, id);

    if (!access.ok) {
      return errorResponse(access.reason === 'NOT_FOUND' ? 'Class not found' : 'Unauthorized', access.reason === 'NOT_FOUND' ? 404 : 403);
    }

    const writableClass = await requireEditableClassByPeriod(id);
    if (!writableClass.ok) {
      return errorResponse('Kelas semester lampau hanya dapat dibaca', 403);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return errorResponse('No file provided', 400);
    }

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    let rows: Record<string, unknown>[] = [];

    if (isExcel) {
      // Parse Excel file
      const { data, headers } = await parseExcelFile(file);
      rows = data;

      const codeHeaderIdx = headers.findIndex(h => h === 'kode');
      const nameHeaderIdx = headers.findIndex(h => h === 'nama');

      if (codeHeaderIdx === -1 || nameHeaderIdx === -1) {
        return errorResponse('Excel must contain "Kode" and "Nama" columns', 400);
      }

      // Headers validated above
    } else {
      // Parse CSV file
      const text = await file.text();
      const lines = text.trim().split('\n');

      if (lines.length < 2) {
        return errorResponse('CSV file must contain at least a header row and one data row', 400);
      }

      // Parse CSV header properly
      const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase());
      const codeIndex = headers.indexOf('kode');
      const nameIndex = headers.indexOf('nama');

      if (codeIndex === -1 || nameIndex === -1) {
        return errorResponse('CSV must contain "Kode" and "Nama" columns', 400);
      }

      // Convert CSV to array of objects
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVRow(lines[i]);
        rows.push({
          kode: values[codeIndex],
          nama: values[nameIndex],
        });
      }

      // CSV headers validated above
    }

    if (rows.length === 0) {
      return errorResponse('File must contain at least one data row', 400);
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const code = isExcel
        ? row[Object.keys(row)[Object.keys(row).findIndex((k) => normalizeColumnName(k) === 'kode')]]
        : row.kode;
      const name = isExcel
        ? row[Object.keys(row)[Object.keys(row).findIndex((k) => normalizeColumnName(k) === 'nama')]]
        : row.nama;

      if (!code || !name) {
        results.skipped++;
        continue;
      }

      try {
        // Find subject by code
        const subject = await prisma.subject.findFirst({
          where: {
            code: code.toString(),
          },
        });

        if (!subject) {
          results.errors.push(`Row ${i + 2}: Subject with code "${code}" not found`);
          continue;
        }

        // Check if already assigned
        const existing = await prisma.classSubject.findUnique({
          where: {
            classId_subjectId: {
              classId: id,
              subjectId: subject.id,
            },
          },
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        // Create class subject
        await prisma.classSubject.create({
          data: {
            classId: id,
            subjectId: subject.id,
          },
        });

        results.imported++;
      } catch (error: unknown) {
        results.errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    await logActivity({
      userId: user.id,
      action: 'IMPORT',
      resourceType: 'ClassSubject',
      resourceId: id,
      resourceName: `Imported ${results.imported} subjects`,
      description: `Imported subjects to class from ${isExcel ? 'Excel' : 'CSV'} file`,
      newValue: results,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(results, 'Subjects imported successfully');
  } catch (error: unknown) {
    serverError('Import subjects error:', error);
    if (user) {
      await logActivity({
        userId: user.id,
        action: 'IMPORT',
        resourceType: 'ClassSubject',
        resourceId: '',
        description: 'Failed to import subjects',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
      });
    }
    return errorResponse('Failed to import subjects', 500);
  }
}
