import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { handleError } from '@/middleware/errorHandler';

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL')) return user;
  return null;
}

/**
 * GET /api/admin/raport-mental/nilai?studentNo=xxx&schoolYearId=xxx&semesterId=xxx
 * Ambil semua nilai raport mental seorang santri untuk tahun/semester tertentu
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) return errorResponse('Unauthorized', 401);

    const url = new URL(request.url);
    const studentNo = url.searchParams.get('studentNo');
    const schoolYearId = url.searchParams.get('schoolYearId');
    const semesterId = url.searchParams.get('semesterId');

    if (!studentNo) return errorResponse('studentNo wajib diisi', 400);

    const nilai = await prisma.raportMentalNilai.findMany({
      where: {
        studentNo,
        ...(schoolYearId ? { schoolYearId } : {}),
        ...(semesterId ? { semesterId } : {}),
      },
      include: {
        seksi: { select: { id: true, nama: true, kode: true, urutan: true, tipeNilai: true } },
        aspek: { select: { id: true, nama: true, urutan: true, punyaFieldData: true, fieldDataType: true } },
        schoolYear: { select: { id: true, year: true, tahunAkademik: true } },
        semester: { select: { id: true, number: true, semesterLabel: true } },
      },
      orderBy: [
        { seksi: { urutan: 'asc' } },
        { aspek: { urutan: 'asc' } },
      ],
    });

    return successResponse(nilai);
  } catch (error) {
    console.error('Error fetching nilai:', error);
    return errorResponse('Gagal memuat data nilai', 500);
  }
}

/**
 * POST /api/admin/raport-mental/nilai
 * Batch upsert nilai raport mental santri
 * Body: { studentNo, schoolYearId, semesterId, items: [{ aspekId, seksiId, nilai, dataEkstra }] }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) return errorResponse('Unauthorized', 401);

    const body = await request.json();
    const { studentNo, schoolYearId, semesterId, items } = body;

    if (!studentNo || !schoolYearId || !semesterId) {
      return errorResponse('studentNo, schoolYearId, dan semesterId wajib diisi', 400);
    }

    if (!Array.isArray(items)) {
      return errorResponse('items harus berupa array', 400);
    }

    // Validasi santri ada
    const santri = await prisma.santri.findUnique({ where: { studentNo } });
    if (!santri) return errorResponse('Data santri tidak ditemukan', 404);

    // Validasi schoolYear dan semester
    const schoolYear = await prisma.schoolYear.findUnique({ where: { id: schoolYearId } });
    if (!schoolYear) return errorResponse('Tahun ajaran tidak ditemukan', 404);

    const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (!semester) return errorResponse('Semester tidak ditemukan', 404);

    const normalizedItems = items.map((item: { aspekId?: string; seksiId?: string; nilai?: string; dataEkstra?: string }) => ({
      aspekId: String(item.aspekId || '').trim(),
      seksiId: String(item.seksiId || '').trim(),
      nilai: typeof item.nilai === 'string' ? item.nilai.trim() : '',
      dataEkstra: typeof item.dataEkstra === 'string' ? item.dataEkstra.trim() : '',
    }));

    const invalidItem = normalizedItems.find(item => !item.aspekId || !item.seksiId);
    if (invalidItem) {
      return errorResponse('Setiap item wajib memiliki aspekId dan seksiId', 400);
    }

    const duplicateAspekId = normalizedItems.find((item, index) =>
      normalizedItems.findIndex(candidate => candidate.aspekId === item.aspekId) !== index
    )?.aspekId;
    if (duplicateAspekId) {
      return errorResponse(`Duplikasi aspek pada payload simpan: ${duplicateAspekId}`, 400);
    }

    const aspekIds = normalizedItems.map(item => item.aspekId);
    const aspekList = aspekIds.length > 0
      ? await prisma.raportMentalAspek.findMany({
          where: { id: { in: aspekIds } },
          select: { id: true, seksiId: true, isActive: true },
        })
      : [];
    const aspekMap = new Map(aspekList.map(aspek => [aspek.id, aspek]));

    const invalidRelationItem = normalizedItems.find((item) => {
      const aspek = aspekMap.get(item.aspekId);
      return !aspek || aspek.seksiId !== item.seksiId;
    });

    if (invalidRelationItem) {
      return errorResponse('Ada data aspek/seksi yang tidak valid. Muat ulang halaman lalu coba simpan lagi.', 400);
    }

    await prisma.$transaction(async (tx) => {
      const keepAspekIds = normalizedItems.map(item => item.aspekId);

      await tx.raportMentalNilai.deleteMany({
        where: {
          studentNo,
          schoolYearId,
          semesterId,
          ...(keepAspekIds.length > 0 ? { aspekId: { notIn: keepAspekIds } } : {}),
        },
      });

      await Promise.all(
        normalizedItems.map((item) =>
          tx.raportMentalNilai.upsert({
            where: {
              studentNo_aspekId_schoolYearId_semesterId: {
                studentNo,
                aspekId: item.aspekId,
                schoolYearId,
                semesterId,
              },
            },
            create: {
              studentNo,
              seksiId: item.seksiId,
              aspekId: item.aspekId,
              schoolYearId,
              semesterId,
              nilai: item.nilai || null,
              dataEkstra: item.dataEkstra || null,
            },
            update: {
              seksiId: item.seksiId,
              nilai: item.nilai || null,
              dataEkstra: item.dataEkstra || null,
            },
          })
        )
      );
    });

    return successResponse({ count: normalizedItems.length }, `${normalizedItems.length} nilai berhasil disimpan`);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error('Error saving nilai (Prisma):', {
        code: error.code,
        meta: error.meta,
        message: error.message,
      });
    } else {
      console.error('Error saving nilai:', error);
    }
    return handleError(error);
  }
}
