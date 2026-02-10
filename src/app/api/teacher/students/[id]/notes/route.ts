import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = verifyAccessToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id: studentId } = await params;
    const classId = request.nextUrl.searchParams.get('classId');
    const semesterId = request.nextUrl.searchParams.get('semesterId');

    console.log('📝 Notes GET - studentId:', studentId, 'classId:', classId, 'semesterId:', semesterId);

    if (!classId) {
      return NextResponse.json({ error: 'classId is required' }, { status: 400 });
    }

    // Get student note
    const whereClause: any = {
      studentId: studentId,
      classId: classId,
    };

    if (semesterId) {
      whereClause.semesterId = semesterId;
    }

    console.log('📝 Notes GET - whereClause:', whereClause);

    const studentNote = await prisma.studentNote.findFirst({
      where: whereClause,
    });

    console.log('📝 Notes GET - studentNote:', studentNote);

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
    console.error('Error fetching student note:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = verifyAccessToken(token);
    if (!user || (user.role !== 'WALI_KELAS' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: studentId } = await params;
    const body = await request.json();
    const { classId, semesterId, developmentNotes, achievedCompetencies, improvementAreas } = body;

    console.log('📝 Notes POST - studentId:', studentId, 'classId:', classId, 'semesterId:', semesterId);

    if (!classId) {
      return NextResponse.json({ error: 'classId is required' }, { status: 400 });
    }

    // Find existing note
    const whereClause: any = {
      studentId: studentId,
      classId: classId,
    };

    if (semesterId) {
      whereClause.semesterId = semesterId;
    } else {
      whereClause.semesterId = null;
    }

    console.log('📝 Notes POST - whereClause:', whereClause);

    const existingNote = await prisma.studentNote.findFirst({
      where: whereClause,
    });

    console.log('📝 Notes POST - existingNote:', existingNote);

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
      console.log('📝 Notes POST - Updated note');
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
      console.log('📝 Notes POST - Created new note');
    }

    return NextResponse.json({
      success: true,
      data: studentNote,
    });
  } catch (error) {
    console.error('Error creating/updating student note:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
