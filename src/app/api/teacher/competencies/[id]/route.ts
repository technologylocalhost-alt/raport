import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decoded = verifyAccessToken(token);
    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { name, code, type } = await request.json();

    // Validate required fields
    if (!name || !type) {
      return NextResponse.json(
        { success: false, message: 'Nama dan Tipe kompetensi wajib diisi' },
        { status: 400 }
      );
    }

    // Get the competency and verify ownership
    const competency = await prisma.competency.findUnique({
      where: { id },
      include: {
        subject: true,
      },
    });

    if (!competency) {
      return NextResponse.json(
        { success: false, message: 'Kompetensi tidak ditemukan' },
        { status: 404 }
      );
    }

    if (competency.teacherId !== decoded.userId) {
      return NextResponse.json(
        { success: false, message: 'Anda tidak authorized untuk kompetensi ini' },
        { status: 403 }
      );
    }

    // Update competency
    const updated = await prisma.competency.update({
      where: { id },
      data: {
        name,
        code: code || null,
        type,
      },
      include: {
        subject: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Kompetensi berhasil diperbarui',
      data: {
        id: updated.id,
        name: updated.name,
        code: updated.code,
        subjectName: updated.subject?.name || '',
        subjectCode: updated.subject?.code || '',
      },
    });
  } catch (error) {
    console.error('Error updating competency:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui kompetensi' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decoded = verifyAccessToken(token);
    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Get the competency and verify ownership
    const competency = await prisma.competency.findUnique({
      where: { id },
      include: {
        subject: true,
      },
    });

    if (!competency) {
      return NextResponse.json(
        { success: false, message: 'Kompetensi tidak ditemukan' },
        { status: 404 }
      );
    }

    if (competency.teacherId !== decoded.userId) {
      return NextResponse.json(
        { success: false, message: 'Anda tidak authorized untuk kompetensi ini' },
        { status: 403 }
      );
    }

    // Delete competency
    await prisma.competency.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Kompetensi berhasil dihapus',
    });
  } catch (error) {
    console.error('Error deleting competency:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus kompetensi' },
      { status: 500 }
    );
  }
}
