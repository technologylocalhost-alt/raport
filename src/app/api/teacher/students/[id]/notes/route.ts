import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth/access';
import { serverError } from '@/lib/server-log';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRoles(request, ['TEACHER', 'WALI_KELAS', 'ADMIN']);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id: studentId } = await params;
    const classId = request.nextUrl.searchParams.get('classId');
    const semesterId = request.nextUrl.searchParams.get('semesterId');


    if (!classId) {
      return NextResponse.json({ error: 'classId is required' }, { status: 400 });
    }

    // Get student note
    const whereClause: Record<string, string> = {
      studentId: studentId,
      classId: classId,
    };

    if (semesterId) {
      whereClause.semesterId = semesterId;
    }


    const studentNote = await prisma.studentNote.findFirst({
      where: whereClause,
    });


    if (!studentNote) {
      return NextResponse.json({
        success: true,
        data: {
          developmentNotes: '',
          achievedCompetencies: '',
          improvementAreas: '',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: studentNote.id,
        developmentNotes: studentNote.developmentNotes || '',
        achievedCompetencies: studentNote.achievedCompetencies || '',
        improvementAreas: studentNote.improvementAreas || '',
      },
    });
  } catch (error) {
    serverError('Error fetching student note:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRoles(request, ['WALI_KELAS', 'ADMIN']);
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: studentId } = await params;
    const body = await request.json();
    const { classId, semesterId, developmentNotes, achievedCompetencies, improvementAreas } = body;


    if (!classId) {
      return NextResponse.json({ error: 'classId is required' }, { status: 400 });
    }

    // Find existing note
    const whereClause: Record<string, string | null> = {
      studentId: studentId,
      classId: classId,
    };

    if (semesterId) {
      whereClause.semesterId = semesterId;
    } else {
      whereClause.semesterId = null;
    }


    const existingNote = await prisma.studentNote.findFirst({
      where: whereClause,
    });


    let studentNote;
    if (existingNote) {
      // Update existing
      studentNote = await prisma.studentNote.update({
        where: { id: existingNote.id },
        data: {
          developmentNotes,
          achievedCompetencies,
          improvementAreas,
        },
      });
    } else {
      // Create new
      studentNote = await prisma.studentNote.create({
        data: {
          studentId: studentId,
          classId: classId,
          semesterId: semesterId || null,
          developmentNotes,
          achievedCompetencies,
          improvementAreas,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: studentNote,
    });
  } catch (error) {
    serverError('Error creating/updating student note:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
