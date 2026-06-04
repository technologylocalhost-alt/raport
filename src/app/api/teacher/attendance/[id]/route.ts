import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { requireTeacherOnly } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

async function requireTeacherAccess(req: NextRequest) {
  return requireTeacherOnly(req);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let id = '';
  let teacher;
  try {
    const result = await params;
    id = result.id;
    teacher = await requireTeacherAccess(req);
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

    await logActivity({
      userId: teacher.id,
      action: 'UPDATE',
      resourceType: 'Attendance',
      resourceId: id,
      resourceName: `${updated.student.name} - ${new Date(updated.date).toLocaleDateString()}`,
      description: `Updated attendance for ${updated.student.name}`,
      newValue: { status: status || attendance.status, notes: notes !== undefined ? notes : attendance.notes },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    serverError('Error updating attendance:', error);
    await logActivity({
      userId: teacher?.id || 'unknown',
      action: 'UPDATE',
      resourceType: 'Attendance',
      resourceId: id,
      description: `Failed to update attendance`,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      status: 'FAILED',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let id = '';
  let teacher;
  try {
    const result = await params;
    id = result.id;
    teacher = await requireTeacherAccess(req);
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

    await logActivity({
      userId: teacher.id,
      action: 'DELETE',
      resourceType: 'Attendance',
      resourceId: id,
      resourceName: `${attendance.student.name} - ${new Date(attendance.date).toLocaleDateString()}`,
      description: `Deleted attendance record for ${attendance.student.name}`,
      oldValue: {
        studentId: attendance.studentId,
        date: attendance.date,
        status: attendance.status,
        notes: attendance.notes,
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      message: 'Attendance deleted',
    });
  } catch (error) {
    serverError('Error deleting attendance:', error);
    await logActivity({
      userId: teacher?.id || 'unknown',
      action: 'DELETE',
      resourceType: 'Attendance',
      resourceId: id,
      description: `Failed to delete attendance`,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      status: 'FAILED',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
