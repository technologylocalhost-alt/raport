import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireMenuAccess } from '@/lib/auth/verify-access';
import { AuthenticatedUser } from '@/lib/auth/access';
import {
  parseClassName,
  calculateNextClass,
  buildClassName,
} from '@/lib/class-promotion';
import { getNextSchoolYearForPromotion, getSemesterByNumber } from '@/lib/promotion-period';
import { serverError } from '@/lib/server-log';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';

async function requireGenerateTargetAccess(req: NextRequest) {
  return requireMenuAccess(req, '/admin/naik-kelas', ['ADMIN', 'PRINCIPAL']);
}

type TeacherPreview = {
  teacher: { id: string; name: string; email: string };
  subject: { id: string; name: string; code: string };
};

type GeneratedClassPreview = {
  id: string | null;
  name: string;
  capacity: number;
  level: {
    id: string;
    name: string;
    code: string;
    order: number;
    levelCount: number | null;
  };
  schoolYear: { id: string; year: string };
  semester: { id: string; number: number };
  waliKelas: { id: string; name: string; email: string } | null;
  isActive: boolean;
  teachers: TeacherPreview[];
  _count: { students: number };
};

type TargetGenerationPlan =
  | {
      ok: true;
      promotionType: 'SEMESTER' | 'LEVEL';
      targetSchoolYear: { id: string; year: string };
      targetSemester: { id: string; number: number };
      targetName: string;
      previewClass: GeneratedClassPreview;
      existingClass: { id: string } | null;
      createData: {
        levelId: string;
        schoolYearId: string;
        semesterId: string;
        name: string;
        capacity: number;
        waliKelasId: string | null;
        isActive: boolean;
      };
      sourceClass: {
        id: string;
        name: string;
        teachers: Array<{
          teacherId: string;
          subjectId: string;
        }>;
      };
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

async function loadSourceClass(sourceClassId: string) {
  return prisma.class.findUnique({
    where: { id: sourceClassId },
    include: {
      level: true,
      semester: true,
      schoolYear: {
        select: {
          id: true,
          year: true,
          startDate: true,
        },
      },
      waliKelas: { select: { id: true, name: true, email: true } },
      teachers: {
        include: {
          teacher: { select: { id: true, name: true, email: true } },
          subject: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });
}

function buildPreviewClass(params: {
  sourceClass: Awaited<ReturnType<typeof loadSourceClass>>;
  targetSchoolYear: { id: string; year: string };
  targetSemester: { id: string; number: number };
  targetLevel: { id: string; name: string; code: string; order: number; levelCount: number | null };
  targetName: string;
  existingId?: string | null;
}): GeneratedClassPreview {
  const { sourceClass, targetSchoolYear, targetSemester, targetLevel, targetName, existingId = null } = params;

  if (!sourceClass) {
    throw new Error('Source class not loaded');
  }

  return {
    id: existingId,
    name: targetName,
    capacity: sourceClass.capacity,
    level: targetLevel,
    schoolYear: targetSchoolYear,
    semester: targetSemester,
    waliKelas: sourceClass.waliKelas,
    isActive: sourceClass.isActive,
    teachers: sourceClass.teachers.map((assignment) => ({
      teacher: assignment.teacher,
      subject: assignment.subject,
    })),
    _count: { students: 0 },
  };
}

async function buildTargetGenerationPlan(sourceClassId: string): Promise<TargetGenerationPlan> {
  const sourceClass = await loadSourceClass(sourceClassId);
  if (!sourceClass) {
    return { ok: false, status: 404, error: 'Class not found' };
  }

  const classInfo = parseClassName(sourceClass.name);
  if (!classInfo) {
    return {
      ok: false,
      status: 400,
      error: `Nama kelas "${sourceClass.name}" tidak sesuai format`,
    };
  }

  if (!classInfo.levelCode) {
    classInfo.levelCode = sourceClass.level.code;
  }

  const totalSemesters = await prisma.semester.count({
    where: { schoolYearId: sourceClass.schoolYearId },
  });
  const isSemesterProgression = sourceClass.semester.number < totalSemesters;

  const nextLevel = await prisma.level.findFirst({
    where: {
      schoolId: sourceClass.level.schoolId,
      order: sourceClass.level.order + 1,
    },
    select: { id: true, name: true, code: true, order: true, levelCount: true },
  });

  const nextClassInfo = calculateNextClass(
    classInfo,
    {
      code: sourceClass.level.code,
      levelCount: sourceClass.level.levelCount || 0,
      order: sourceClass.level.order,
    },
    nextLevel
  );

  if (isSemesterProgression) {
    const nextSemester = await getSemesterByNumber(sourceClass.schoolYearId, sourceClass.semester.number + 1);
    if (!nextSemester) {
      return {
        ok: false,
        status: 400,
        error: `Semester berikutnya untuk tahun ajaran ${sourceClass.schoolYear.year} belum tersedia`,
      };
    }

    const existingClass = await prisma.class.findFirst({
      where: {
        levelId: sourceClass.levelId,
        schoolYearId: sourceClass.schoolYearId,
        semesterId: nextSemester.id,
        name: sourceClass.name,
      },
      select: { id: true },
    });

    return {
      ok: true,
      promotionType: 'SEMESTER',
      targetSchoolYear: {
        id: sourceClass.schoolYear.id,
        year: sourceClass.schoolYear.year,
      },
      targetSemester: {
        id: nextSemester.id,
        number: nextSemester.number,
      },
      targetName: sourceClass.name,
      previewClass: buildPreviewClass({
        sourceClass,
        targetSchoolYear: {
          id: sourceClass.schoolYear.id,
          year: sourceClass.schoolYear.year,
        },
        targetSemester: {
          id: nextSemester.id,
          number: nextSemester.number,
        },
        targetLevel: {
          id: sourceClass.level.id,
          name: sourceClass.level.name,
          code: sourceClass.level.code,
          order: sourceClass.level.order,
          levelCount: sourceClass.level.levelCount,
        },
        targetName: sourceClass.name,
        existingId: existingClass?.id || null,
      }),
      existingClass: existingClass ? { id: existingClass.id } : null,
      createData: {
        levelId: sourceClass.levelId,
        schoolYearId: sourceClass.schoolYearId,
        semesterId: nextSemester.id,
        name: sourceClass.name,
        capacity: sourceClass.capacity,
        waliKelasId: sourceClass.waliKelasId,
        isActive: sourceClass.isActive,
      },
      sourceClass: {
        id: sourceClass.id,
        name: sourceClass.name,
        teachers: sourceClass.teachers.map((teacher) => ({
          teacherId: teacher.teacherId,
          subjectId: teacher.subjectId,
        })),
      },
    };
  }

  if (!nextClassInfo) {
    return {
      ok: false,
      status: 400,
      error: 'Target kelas level berikutnya belum dapat dihitung',
    };
  }

  const nextSchoolYear = await getNextSchoolYearForPromotion(
    sourceClass.level.schoolId,
    sourceClass.schoolYear.startDate
  );
  if (!nextSchoolYear) {
    return {
      ok: false,
      status: 400,
      error: 'Tahun ajaran berikutnya belum tersedia',
    };
  }

  const nextSemester = await getSemesterByNumber(nextSchoolYear.id, 1);
  if (!nextSemester) {
    return {
      ok: false,
      status: 400,
      error: `Semester 1 untuk tahun ajaran ${nextSchoolYear.year} belum tersedia`,
    };
  }

  const targetName = buildClassName(
    nextClassInfo.nextLevelCode,
    nextClassInfo.nextClassNumber,
    classInfo.classChar
  );

  const targetLevel = nextClassInfo.promotionType === 'NEXT_LEVEL'
    ? nextLevel
    : sourceClass.level;

  if (!targetLevel) {
    return {
      ok: false,
      status: 400,
      error: 'Target level tidak tersedia',
    };
  }

  const existingClass = await prisma.class.findFirst({
    where: {
      levelId: targetLevel.id,
      schoolYearId: nextSchoolYear.id,
      semesterId: nextSemester.id,
      name: targetName,
    },
    select: { id: true },
  });

  return {
    ok: true,
    promotionType: 'LEVEL',
    targetSchoolYear: {
      id: nextSchoolYear.id,
      year: nextSchoolYear.year,
    },
    targetSemester: {
      id: nextSemester.id,
      number: nextSemester.number,
    },
    targetName,
    previewClass: buildPreviewClass({
      sourceClass,
      targetSchoolYear: {
        id: nextSchoolYear.id,
        year: nextSchoolYear.year,
      },
      targetSemester: {
        id: nextSemester.id,
        number: nextSemester.number,
      },
      targetLevel: {
        id: targetLevel.id,
        name: targetLevel.name,
        code: targetLevel.code,
        order: targetLevel.order,
        levelCount: targetLevel.levelCount,
      },
      targetName,
      existingId: existingClass?.id || null,
    }),
    existingClass: existingClass ? { id: existingClass.id } : null,
    createData: {
      levelId: targetLevel.id,
      schoolYearId: nextSchoolYear.id,
      semesterId: nextSemester.id,
      name: targetName,
      capacity: sourceClass.capacity,
      waliKelasId: sourceClass.waliKelasId,
      isActive: sourceClass.isActive,
    },
    sourceClass: {
      id: sourceClass.id,
      name: sourceClass.name,
      teachers: sourceClass.teachers.map((teacher) => ({
        teacherId: teacher.teacherId,
        subjectId: teacher.subjectId,
      })),
    },
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceClassId } = await params;
    const admin = await requireGenerateTargetAccess(request);
    if (!admin) return errorResponse('Unauthorized', 401);

    const plan = await buildTargetGenerationPlan(sourceClassId);
    if (!plan.ok) {
      return errorResponse(plan.error, plan.status);
    }

    return successResponse({
      preview: true,
      created: false,
      promotionType: plan.promotionType,
      targetSchoolYear: plan.targetSchoolYear,
      targetSemester: plan.targetSemester,
      targetName: plan.targetName,
      class: plan.previewClass,
      existing: Boolean(plan.existingClass),
      message: plan.existingClass
        ? 'Kelas tujuan sudah ada, pratinjau menampilkan data kelas yang tersedia'
        : 'Pratinjau kelas tujuan siap ditampilkan',
    });
  } catch (error) {
    serverError('Preview target class error:', error);
    return errorResponse('Gagal memuat pratinjau kelas tujuan', 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin: AuthenticatedUser | null = null;
  try {
    const { id: sourceClassId } = await params;
    admin = await requireGenerateTargetAccess(request);
    if (!admin) return errorResponse('Unauthorized', 401);

    const plan = await buildTargetGenerationPlan(sourceClassId);
    if (!plan.ok) {
      return errorResponse(plan.error, plan.status);
    }

    if (plan.existingClass) {
      return successResponse({
        created: false,
        class: plan.previewClass,
        message: 'Kelas tujuan sudah ada',
      });
    }

    const createdClassRecord = await prisma.$transaction(async (tx) => {
      const newClass = await tx.class.create({
        data: plan.createData,
        include: {
          level: true,
          schoolYear: true,
          semester: true,
          waliKelas: { select: { id: true, name: true, email: true } },
          teachers: {
            include: {
              teacher: true,
              subject: true,
            },
          },
          _count: { select: { students: true } },
        },
      });

      if (plan.sourceClass.teachers.length > 0) {
        await tx.classTeacher.createMany({
          data: plan.sourceClass.teachers.map((teacher) => ({
            classId: newClass.id,
            teacherId: teacher.teacherId,
            subjectId: teacher.subjectId,
          })),
          skipDuplicates: true,
        });
      }

      return newClass;
    });

    const createdClass = await prisma.class.findUnique({
      where: { id: createdClassRecord.id },
      include: {
        level: true,
        schoolYear: true,
        semester: true,
        waliKelas: { select: { id: true, name: true, email: true } },
        teachers: {
          include: {
            teacher: true,
            subject: true,
          },
        },
        _count: { select: { students: true } },
      },
    });

    if (!createdClass) {
      return errorResponse('Target class created but failed to load', 500);
    }

    await logActivity({
      userId: admin.id,
      action: 'CREATE',
      resourceType: 'Class',
      resourceId: createdClass.id,
      resourceName: createdClass.name,
      description:
        plan.promotionType === 'SEMESTER'
          ? `Auto-generated target class ${createdClass.name} for semester progression from ${plan.sourceClass.name}`
          : `Auto-generated target class ${createdClass.name} for level progression from ${plan.sourceClass.name}`,
      newValue: {
        sourceClassId,
        targetClassId: createdClass.id,
        schoolYearId: createdClass.schoolYearId,
        semesterId: createdClass.semesterId,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse({
      created: true,
      class: createdClass,
      message: `Kelas tujuan ${createdClass.name} berhasil digenerate`,
    }, 201);
  } catch (error) {
    serverError('Generate target class error:', error);
    return errorResponse('Gagal menggenerate kelas tujuan', 500);
  }
}
