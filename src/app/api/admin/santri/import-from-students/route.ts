import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { requireMenuAccess } from '@/lib/auth/verify-access';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { serverError } from '@/lib/server-log';

async function requireSantriImportAccess(req: NextRequest) {
  return requireMenuAccess(req, '/admin/santri', ['ADMIN', 'PRINCIPAL']);
}

/**
 * POST /api/admin/santri/import-from-students
 * Copy unique students (by studentNo) from Student table to Santri table
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireSantriImportAccess(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Get all unique students grouped by studentNo (take latest record)
    const students = await prisma.student.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    // Deduplicate by studentNo - keep the latest
    const uniqueMap = new Map<string, typeof students[0]>();
    for (const s of students) {
      if (!uniqueMap.has(s.studentNo)) {
        uniqueMap.set(s.studentNo, s);
      }
    }

    // Get existing santri studentNos to skip duplicates
    const existingSantri = await prisma.santri.findMany({
      select: { studentNo: true },
    });
    const existingNos = new Set(existingSantri.map((s) => s.studentNo));

    // Filter out already imported
    const toImport = Array.from(uniqueMap.values()).filter(
      (s) => !existingNos.has(s.studentNo)
    );

    if (toImport.length === 0) {
      return successResponse(
        { imported: 0, skipped: uniqueMap.size },
        'Semua data student sudah ada di tabel santri'
      );
    }

    // Bulk create
    const result = await prisma.santri.createMany({
      data: toImport.map((s) => ({
        studentNo: s.studentNo,
        name: s.name,
        gender: s.gender,
        birthDate: s.birthDate,
        phone: s.phone,
        address: s.address,
        parentPhoneNo: s.parentPhoneNo,
      })),
      skipDuplicates: true,
    });

    await logActivity({
      userId: user.id,
      action: 'IMPORT',
      resourceType: 'Santri',
      description: `Imported ${result.count} santri from Student table (${existingNos.size} skipped)`,
      newValue: { imported: result.count, skipped: existingNos.size },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse({
      imported: result.count,
      skipped: existingNos.size,
      total: uniqueMap.size,
    });
  } catch (error) {
    serverError('Error importing from students:', error);
    return errorResponse('Gagal import data dari tabel student', 500);
  }
}
