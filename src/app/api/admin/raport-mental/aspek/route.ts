import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';

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
 * GET /api/admin/raport-mental/aspek?seksiId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) return errorResponse('Unauthorized', 401);

    const url = new URL(request.url);
    const seksiId = url.searchParams.get('seksiId');
    const includeInactive = url.searchParams.get('includeInactive') === 'true';

    const aspek = await prisma.raportMentalAspek.findMany({
      where: {
        ...(seksiId ? { seksiId } : {}),
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: { seksi: { select: { id: true, nama: true, kode: true } } },
      orderBy: [{ seksiId: 'asc' }, { urutan: 'asc' }],
    });

    return successResponse(aspek);
  } catch (error) {
    console.error('Error fetching aspek:', error);
    return errorResponse('Gagal memuat data aspek', 500);
  }
}

/**
 * POST /api/admin/raport-mental/aspek
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) return errorResponse('Unauthorized', 401);

    const body = await request.json();
    const { seksiId, nama, keterangan, urutan, punyaFieldData, fieldDataType } = body;

    if (!seksiId || !nama) {
      return errorResponse('seksiId dan nama aspek wajib diisi', 400);
    }

    const seksiExists = await prisma.raportMentalSeksi.findUnique({ where: { id: seksiId } });
    if (!seksiExists) return errorResponse('Seksi tidak ditemukan', 404);

    // Urutan otomatis
    let urutanFinal = urutan;
    if (urutanFinal === undefined || urutanFinal === null) {
      const last = await prisma.raportMentalAspek.findFirst({
        where: { seksiId },
        orderBy: { urutan: 'desc' },
      });
      urutanFinal = (last?.urutan ?? -1) + 1;
    }

    const aspek = await prisma.raportMentalAspek.create({
      data: {
        seksiId,
        nama,
        keterangan: keterangan || null,
        urutan: urutanFinal,
        punyaFieldData: fieldDataType ? fieldDataType !== 'NONE' : (punyaFieldData ?? false),
        fieldDataType: fieldDataType || (punyaFieldData ? 'TEXT' : 'NONE'),
        isActive: true,
      },
    });

    return successResponse(aspek, 'Aspek berhasil dibuat');
  } catch (error) {
    console.error('Error creating aspek:', error);
    return errorResponse('Gagal membuat aspek', 500);
  }
}
