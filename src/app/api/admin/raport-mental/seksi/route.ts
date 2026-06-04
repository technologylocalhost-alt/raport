import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { requireRaportMentalAccess } from '@/lib/auth/access';
import { serverError } from '@/lib/server-log';

async function requireRaportMental(req: NextRequest) {
  return requireRaportMentalAccess(req, '/admin/raport-mental');
}

/**
 * GET /api/admin/raport-mental/seksi
 * List semua seksi raport mental beserta aspek-aspeknya
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRaportMental(request);
    if (!user) return errorResponse('Unauthorized', 401);

    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('includeInactive') === 'true';

    const seksi = await prisma.raportMentalSeksi.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: {
        aspek: {
          where: includeInactive ? undefined : { isActive: true },
          orderBy: { urutan: 'asc' },
        },
      },
      orderBy: { urutan: 'asc' },
    });

    return successResponse(seksi);
  } catch (error) {
    serverError('Error fetching raport mental seksi:', error);
    return errorResponse('Gagal memuat data seksi', 500);
  }
}

/**
 * POST /api/admin/raport-mental/seksi
 * Buat seksi baru
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRaportMental(request);
    if (!user) return errorResponse('Unauthorized', 401);

    const body = await request.json();
    const { nama, kode, deskripsi, urutan, tipeNilai } = body;

    if (!nama || !kode) {
      return errorResponse('Nama dan kode seksi wajib diisi', 400);
    }

    // Cek duplikat kode
    const existing = await prisma.raportMentalSeksi.findUnique({ where: { kode } });
    if (existing) return errorResponse('Kode seksi sudah digunakan', 409);

    // Tentukan urutan otomatis jika tidak diisi
    let urutanFinal = urutan;
    if (urutanFinal === undefined || urutanFinal === null) {
      const last = await prisma.raportMentalSeksi.findFirst({ orderBy: { urutan: 'desc' } });
      urutanFinal = (last?.urutan ?? -1) + 1;
    }

    const seksi = await prisma.raportMentalSeksi.create({
      data: {
        nama,
        kode,
        deskripsi: deskripsi || null,
        urutan: urutanFinal,
        tipeNilai: tipeNilai || 'NILAI_ABCD',
        isActive: true,
      },
    });

    return successResponse(seksi, 'Seksi berhasil dibuat');
  } catch (error) {
    serverError('Error creating seksi:', error);
    return errorResponse('Gagal membuat seksi', 500);
  }
}
