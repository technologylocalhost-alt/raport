import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';

async function getTeacher(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    return null;
  }

  const teacher = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (teacher && teacher.role === 'TEACHER') {
    return teacher;
  }
  return null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const teacher = await getTeacher(req);
    if (!teacher || teacher.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { status, notes } = body;

    const attendance = await prisma.attendance.findUnique({
      where: { id },
      include: { student: { include: { class: true } } },
    });

    if (!attendance) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
    }

    // Verify teacher has access
    const classTeacher = await prisma.classTeacher.findFirst({
      where: { classId: attendance.student.classId, teacherId: teacher.id },
    });

    if (!classTeacher) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        status: status || attendance.status,
        notes: notes !== undefined ? notes : attendance.notes,
      },
      include: { student: true },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Error updating attendance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const teacher = await getTeacher(req);
    if (!teacher || teacher.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const attendance = await prisma.attendance.findUnique({
      where: { id },
      include: { student: { include: { class: true } } },
    });

    if (!attendance) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
    }

    // Verify teacher has access
    const classTeacher = await prisma.classTeacher.findFirst({
      where: { classId: attendance.student.classId, teacherId: teacher.id },
    });

    if (!classTeacher) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await prisma.attendance.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Attendance deleted',
    });
  } catch (error) {
    console.error('Error deleting attendance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
