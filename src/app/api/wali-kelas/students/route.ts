import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireWaliKelasOnly } from '@/lib/auth/role-access';
import { serverError } from '@/lib/server-log';

async function requireWaliKelasAccess(req: NextRequest) {
  return requireWaliKelasOnly(req);
}

export async function GET(req: NextRequest) {
  try {
    const waliKelas = await requireWaliKelasAccess(req);
    if (!waliKelas || waliKelas.role !== 'WALI_KELAS') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const classId = searchParams.get('classId');

    const skip = (page - 1) * limit;

    const whereClause: Record<string, unknown> = {};

    if (classId) {
      whereClause.classId = classId;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { studentNo: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const students = await prisma.student.findMany({
      where: whereClause,
      include: {
        class: {
          include: {
            level: true,
            schoolYear: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: [
        { nourut: { sort: 'asc', nulls: 'last' } },
        { name: 'asc' },
      ],
    });

    const total = await prisma.student.count({ where: whereClause });

    return NextResponse.json({
      success: true,
      data: students.map((s) => ({
        id: s.id,
        name: s.name,
        nisn: s.studentNo,
        nourut: s.nourut,
        className: s.class.name,
        levelName: s.class.level.name,
        email: s.email,
        phone: s.phone,
        birthDate: s.birthDate?.toISOString().split('T')[0],
        address: s.address,
      })),
      page,
      limit,
      total,
    });
  } catch (error) {
    serverError('Error fetching students:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
