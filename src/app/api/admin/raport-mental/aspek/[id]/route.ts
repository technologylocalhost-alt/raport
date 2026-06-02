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
 * GET /api/admin/raport-mental/aspek/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await verifyAdmin(request);
    if (!user) return errorResponse('Unauthorized', 401);

    const aspek = await prisma.raportMentalAspek.findUnique({
      where: { id },
      include: { seksi: true },
    });
    if (!aspek) return errorResponse('Aspek tidak ditemukan', 404);
    return successResponse(aspek);
  } catch (error) {
    console.error('Error fetching aspek:', error);
    return errorResponse('Gagal memuat data aspek', 500);
  }
}

/**
 * PUT /api/admin/raport-mental/aspek/[id]
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
    const { nama, keterangan, urutan, punyaFieldData, fieldDataType, isActive } = body;

    const existing = await prisma.raportMentalAspek.findUnique({ where: { id } });
    if (!existing) return errorResponse('Aspek tidak ditemukan', 404);

    const updated = await prisma.raportMentalAspek.update({
      where: { id },
      data: {
        ...(nama !== undefined && { nama }),
        ...(keterangan !== undefined && { keterangan }),
        ...(urutan !== undefined && { urutan }),
        ...((punyaFieldData !== undefined || fieldDataType !== undefined) && {
          punyaFieldData: fieldDataType !== undefined ? fieldDataType !== 'NONE' : punyaFieldData,
        }),
        ...(fieldDataType !== undefined && { fieldDataType }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return successResponse(updated, 'Aspek berhasil diperbarui');
  } catch (error) {
    console.error('Error updating aspek:', error);
    return errorResponse('Gagal memperbarui aspek', 500);
  }
}

/**
 * DELETE /api/admin/raport-mental/aspek/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await verifyAdmin(request);
    if (!user) return errorResponse('Unauthorized', 401);

    const existing = await prisma.raportMentalAspek.findUnique({ where: { id } });
    if (!existing) return errorResponse('Aspek tidak ditemukan', 404);

    await prisma.raportMentalAspek.delete({ where: { id } });
    return successResponse(null, 'Aspek berhasil dihapus');
  } catch (error) {
    console.error('Error deleting aspek:', error);
    return errorResponse('Gagal menghapus aspek', 500);
  }
}
