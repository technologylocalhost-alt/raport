import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import * as XLSX from 'xlsx';

// Helper function to parse CSV row properly (handle quoted fields)
function parseCSVRow(row: string): string[] {
  const result = [];
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
): Promise<{ data: Record<string, any>[], headers: string[] }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];

  const headers = Object.keys(data[0] || {}).map(h => normalizeColumnName(h));

  return { data, headers };
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

  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL' || user.role === 'WALI_KELAS')) {
    return user;
  }
  return null;
}

/**
 * POST /api/admin/classes/[id]/teachers/import
 * Import teachers from Excel or CSV
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user: any;
  try {
    user = await verifyAdmin(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    // Verify the class exists
    const classData = await prisma.class.findUnique({
      where: { id },
      select: { id: true, waliKelasId: true },
    });

    if (!classData) {
      return errorResponse('Class not found', 404);
    }

    // If user is WALI_KELAS, verify they own this class
    if (user.role === 'WALI_KELAS' && classData.waliKelasId !== user.id) {
      return errorResponse('Unauthorized', 403);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return errorResponse('No file provided', 400);
    }

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    let rows: any[] = [];

    if (isExcel) {
      // Parse Excel file
      const { data, headers } = await parseExcelFile(file);
      rows = data;

      const emailHeaderIdx = headers.findIndex(h => h === 'email');
      const subjectCodeHeaderIdx = headers.findIndex(h => h === 'kodematapalajaran' || h === 'kodematapelajaran');

      if (emailHeaderIdx === -1 || subjectCodeHeaderIdx === -1) {
        return errorResponse('Excel must contain "Email" and "Kode Mata Pelajaran" columns', 400);
      }
    } else {
      // Parse CSV file
      const text = await file.text();
      const lines = text.trim().split('\n');

      if (lines.length < 2) {
        return errorResponse('CSV file must contain at least a header row and one data row', 400);
      }

      // Parse CSV header properly
      const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase());
      const emailIndex = headers.indexOf('email');
      const subjectCodeIndex = headers.indexOf('kode mata pelajaran');

      if (emailIndex === -1 || subjectCodeIndex === -1) {
        return errorResponse('CSV must contain "Email" and "Kode Mata Pelajaran" columns', 400);
      }

      // Convert CSV to array of objects
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVRow(lines[i]);
        rows.push({
          email: values[emailIndex],
          kodematapalajaran: values[subjectCodeIndex],
        });
      }
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
      
      let email = '';
      let subjectCode = '';

      if (isExcel) {
        // Find email and subject code from row data
        const keys = Object.keys(row);
        email = row[keys.find(k => normalizeColumnName(k) === 'email') || ''];
        subjectCode = row[keys.find(k => normalizeColumnName(k) === 'kodematapalajaran' || normalizeColumnName(k) === 'kodematapelajaran') || ''];
      } else {
        email = row.email;
        subjectCode = row.kodematapalajaran;
      }

      if (!email || !subjectCode) {
        results.skipped++;
        continue;
      }

      try {
        // Find teacher by email
        const teacher = await prisma.user.findFirst({
          where: {
            email: email.toString(),
          },
        });

        if (!teacher) {
          results.errors.push(`Row ${i + 2}: Teacher with email "${email}" not found`);
          continue;
        }

        // Find subject by code
        const subject = await prisma.subject.findFirst({
          where: {
            code: subjectCode.toString(),
          },
        });

        if (!subject) {
          results.errors.push(`Row ${i + 2}: Subject with code "${subjectCode}" not found`);
          continue;
        }

        // Verify subject is assigned to this class
        const classSubject = await prisma.classSubject.findUnique({
          where: {
            classId_subjectId: {
              classId: id,
              subjectId: subject.id,
            },
          },
        });

        if (!classSubject) {
          results.errors.push(`Row ${i + 2}: Subject "${subjectCode}" not assigned to this class`);
          continue;
        }

        // Check if already assigned
        const existing = await prisma.classTeacher.findUnique({
          where: {
            classId_teacherId_subjectId: {
              classId: id,
              teacherId: teacher.id,
              subjectId: subject.id,
            },
          },
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        // Create class teacher
        await prisma.classTeacher.create({
          data: {
            classId: id,
            teacherId: teacher.id,
            subjectId: subject.id,
          },
        });

        results.imported++;
      } catch (error: any) {
        results.errors.push(`Row ${i + 2}: ${error.message}`);
      }
    }

    await logActivity({
      userId: user.id,
      action: 'IMPORT',
      resourceType: 'ClassTeacher',
      resourceId: id,
      resourceName: `Imported ${results.imported} teachers`,
      description: `Imported teachers to class from ${isExcel ? 'Excel' : 'CSV'} file`,
      newValue: results,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(results, 'Teachers imported successfully');
  } catch (error: any) {
    console.error('Import teachers error:', error);
    if (user) {
      await logActivity({
        userId: user.id,
        action: 'IMPORT',
        resourceType: 'ClassTeacher',
        resourceId: '',
        description: 'Failed to import teachers',
        errorMessage: error?.message || 'Unknown error',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
      });
    }
    return errorResponse('Failed to import teachers', 500);
  }
}
