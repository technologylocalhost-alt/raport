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
 * GET /api/admin/raport-mental/seksi/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await verifyAdmin(request);
    if (!user) return errorResponse('Unauthorized', 401);

    const seksi = await prisma.raportMentalSeksi.findUnique({
      where: { id },
      include: {
        aspek: { orderBy: { urutan: 'asc' } },
      },
    });

    if (!seksi) return errorResponse('Seksi tidak ditemukan', 404);
    return successResponse(seksi);
  } catch (error) {
    console.error('Error fetching seksi:', error);
    return errorResponse('Gagal memuat data seksi', 500);
  }
}

/**
 * PUT /api/admin/raport-mental/seksi/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await verifyAdmin(request);
    if (!user) return errorResponse('Unauthorized', 401);

    const body = await request.json();
    const { nama, kode, deskripsi, urutan, tipeNilai, isActive } = body;

    const existing = await prisma.raportMentalSeksi.findUnique({ where: { id } });
    if (!existing) return errorResponse('Seksi tidak ditemukan', 404);

    // Cek duplikat kode jika berubah
    if (kode && kode !== existing.kode) {
      const dup = await prisma.raportMentalSeksi.findUnique({ where: { kode } });
      if (dup) return errorResponse('Kode seksi sudah digunakan', 409);
    }

    const updated = await prisma.raportMentalSeksi.update({
      where: { id },
      data: {
        ...(nama !== undefined && { nama }),
        ...(kode !== undefined && { kode }),
        ...(deskripsi !== undefined && { deskripsi }),
        ...(urutan !== undefined && { urutan }),
        ...(tipeNilai !== undefined && { tipeNilai }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { aspek: { orderBy: { urutan: 'asc' } } },
    });

    return successResponse(updated, 'Seksi berhasil diperbarui');
  } catch (error) {
    console.error('Error updating seksi:', error);
    return errorResponse('Gagal memperbarui seksi', 500);
  }
}

/**
 * DELETE /api/admin/raport-mental/seksi/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await verifyAdmin(request);
    if (!user) return errorResponse('Unauthorized', 401);

    const existing = await prisma.raportMentalSeksi.findUnique({ where: { id } });
    if (!existing) return errorResponse('Seksi tidak ditemukan', 404);

    await prisma.raportMentalSeksi.delete({ where: { id } });
    return successResponse(null, 'Seksi berhasil dihapus');
  } catch (error) {
    console.error('Error deleting seksi:', error);
    return errorResponse('Gagal menghapus seksi', 500);
  }
}
