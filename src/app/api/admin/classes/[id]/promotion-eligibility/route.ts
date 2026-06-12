import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { requireMenuAccess } from '@/lib/auth/verify-access';
import {
  parseClassName,
  calculateNextClass,
  buildClassName,
  matchesClassIdentity,
} from '@/lib/class-promotion';
import { getNextSchoolYearForPromotion, getSemesterByNumber } from '@/lib/promotion-period';
import { serverError } from '@/lib/server-log';

async function requirePromotionEligibilityAccess(req: NextRequest) {
  return requireMenuAccess(req, '/admin/naik-kelas', ['ADMIN', 'PRINCIPAL']);
}

/**
 * GET /api/admin/classes/[id]/promotion-eligibility
 * Cek apakah semua mata pelajaran di kelas sudah di-approve (syarat naik kelas)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: classId } = await params;
    const admin = await requirePromotionEligibilityAccess(request);
    if (!admin) return errorResponse('Unauthorized', 401);

    // Ambil data kelas + level + siswa
    const classData = await prisma.class.findUnique({
      where: { id: classId },
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
        students: { select: { id: true } },
        subjects: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!classData) return errorResponse('Class not found', 404);

    const totalStudents = classData.students.length;
    const studentIds = classData.students.map((s) => s.id);
    const subjects = classData.subjects.map((cs) => cs.subject);

    if (subjects.length === 0) {
      return successResponse({
        eligible: false,
        totalSubjects: 0,
        approvedSubjects: 0,
        pendingSubjects: [],
        totalStudents,
        class: {
          id: classData.id,
          name: classData.name,
          level: classData.level,
        },
        reason: 'Kelas tidak memiliki mata pelajaran',
      });
    }

    if (totalStudents === 0) {
      return successResponse({
        eligible: false,
        totalSubjects: subjects.length,
        approvedSubjects: 0,
        pendingSubjects: subjects,
        totalStudents: 0,
        class: {
          id: classData.id,
          name: classData.name,
          level: classData.level,
        },
        reason: 'Kelas tidak memiliki siswa',
      });
    }

    // Cek setiap subject: apakah semua siswa punya minimal 1 NilaiApprove
    const pendingSubjects: { id: string; name: string; code: string; approvedStudents: number }[] = [];
    let approvedSubjects = 0;

    for (const subject of subjects) {
      // Hitung siswa unik yang punya NilaiApprove untuk subject ini
      const approvedStudentIds = await prisma.nilaiApprove.findMany({
        where: {
          studentId: { in: studentIds },
          subjectId: subject.id,
        },
        select: { studentId: true },
        distinct: ['studentId'],
      });

      const approvedCount = approvedStudentIds.length;

      if (approvedCount >= totalStudents) {
        approvedSubjects++;
      } else {
        pendingSubjects.push({
          id: subject.id,
          name: subject.name,
          code: subject.code,
          approvedStudents: approvedCount,
        });
      }
    }

    const eligible = pendingSubjects.length === 0 && subjects.length > 0;
    const parsed = parseClassName(classData.name);
    if (!parsed) {
      return successResponse({
        eligible: false,
        totalSubjects: subjects.length,
        approvedSubjects,
        pendingSubjects,
        totalStudents,
        class: {
          id: classData.id,
          name: classData.name,
          level: classData.level,
        },
        nextLevel: null,
        promotionType: null,
        targetSchoolYear: null,
        targetSemester: null,
        targetClassName: null,
        targetClassSuggestions: [],
        reason: `Nama kelas "${classData.name}" tidak sesuai format`,
      });
    }

    if (!parsed.levelCode) {
      parsed.levelCode = classData.level.code;
    }

    // Cek level berikutnya
    const nextLevel = await prisma.level.findFirst({
      where: {
        schoolId: classData.level.schoolId,
        order: classData.level.order + 1,
      },
      select: { id: true, name: true, code: true, order: true, levelCount: true },
    });

    const totalSemestersPerYear = await prisma.semester.count({
      where: { schoolYearId: classData.schoolYearId },
    });
    const currentSemester = classData.semester.number;
    const promotionType: 'SEMESTER' | 'LEVEL' =
      currentSemester < totalSemestersPerYear ? 'SEMESTER' : 'LEVEL';

    type TargetClassSuggestion = {
      id: string;
      name: string;
      capacity: number;
      levelId: string;
      level: { id: string; name: string; code: string; order: number; levelCount: number };
      schoolYear: { id: string; year: string };
      semester: { id: string; number: number };
      waliKelas?: { id: string; name: string } | null;
      isActive: boolean;
      _count: { students: number };
    };

    const targetClassSuggestions: TargetClassSuggestion[] = [];
    let targetSchoolYear: { id: string; year: string } | null = null;
    let targetSemester: { id: string; number: number } | null = null;
    let targetClassName: string | null = null;

    if (eligible) {
      if (promotionType === 'SEMESTER') {
        const nextSemester = await getSemesterByNumber(classData.schoolYearId, currentSemester + 1);
        if (!nextSemester) {
          return successResponse({
            eligible: true,
            totalSubjects: subjects.length,
            approvedSubjects,
            pendingSubjects,
            totalStudents,
            class: {
              id: classData.id,
              name: classData.name,
              level: classData.level,
            },
            nextLevel: nextLevel || null,
            promotionType,
            targetSchoolYear: {
              id: classData.schoolYear.id,
              year: classData.schoolYear.year,
            },
            targetSemester: null,
            targetClassName: classData.name,
            targetClassSuggestions: [],
            reason: `Semester berikutnya untuk tahun ajaran ${classData.schoolYear.year} belum tersedia`,
          });
        }

        targetSchoolYear = {
          id: classData.schoolYear.id,
          year: classData.schoolYear.year,
        };
        targetSemester = {
          id: nextSemester.id,
          number: nextSemester.number,
        };
        targetClassName = classData.name;

        const sameLevelClasses = await prisma.class.findMany({
          where: {
            schoolYearId: classData.schoolYearId,
            semesterId: nextSemester.id,
            levelId: classData.levelId,
            name: classData.name,
          },
          select: {
            id: true,
            name: true,
            capacity: true,
            levelId: true,
            level: { select: { id: true, name: true, code: true, order: true, levelCount: true } },
            schoolYear: { select: { id: true, year: true } },
            semester: { select: { id: true, number: true } },
            waliKelas: { select: { id: true, name: true } },
            isActive: true,
            _count: { select: { students: true } },
          },
        });

        targetClassSuggestions.push(...sameLevelClasses);

        if (targetClassSuggestions.length === 0) {
          return successResponse({
            eligible: true,
            totalSubjects: subjects.length,
            approvedSubjects,
            pendingSubjects,
            totalStudents,
            class: {
              id: classData.id,
              name: classData.name,
              level: classData.level,
            },
            nextLevel: nextLevel || null,
            promotionType,
            targetSchoolYear,
            targetSemester,
            targetClassName,
            targetClassSuggestions: [],
            reason: `Kelas tujuan "${classData.name}" untuk semester berikutnya belum tersedia`,
          });
        }
      } else {
        const nextSchoolYear = await getNextSchoolYearForPromotion(
          classData.level.schoolId,
          classData.schoolYear.startDate
        );

        if (!nextSchoolYear) {
          return successResponse({
            eligible: false,
            totalSubjects: subjects.length,
            approvedSubjects,
            pendingSubjects,
            totalStudents,
            class: {
              id: classData.id,
              name: classData.name,
              level: classData.level,
            },
            nextLevel: nextLevel || null,
            promotionType,
            targetSchoolYear: null,
            targetSemester: null,
            targetClassName: null,
            targetClassSuggestions: [],
            reason: 'Tahun ajaran berikutnya belum tersedia',
          });
        }

        const nextSemester = await getSemesterByNumber(nextSchoolYear.id, 1);
        if (!nextSemester) {
          return successResponse({
            eligible: true,
            totalSubjects: subjects.length,
            approvedSubjects,
            pendingSubjects,
            totalStudents,
            class: {
              id: classData.id,
              name: classData.name,
              level: classData.level,
            },
            nextLevel: nextLevel || null,
            promotionType,
            targetSchoolYear: {
              id: nextSchoolYear.id,
              year: nextSchoolYear.year,
            },
            targetSemester: null,
            targetClassName: null,
            targetClassSuggestions: [],
            reason: `Semester 1 untuk tahun ajaran ${nextSchoolYear.year} belum tersedia`,
          });
        }

        const nextClassInfo = calculateNextClass(
          parsed,
          {
            code: classData.level.code,
            levelCount: classData.level.levelCount || 0,
            order: classData.level.order,
          },
          nextLevel
        );

        if (!nextClassInfo) {
          return successResponse({
            eligible: true,
            totalSubjects: subjects.length,
            approvedSubjects,
            pendingSubjects,
            totalStudents,
            class: {
              id: classData.id,
              name: classData.name,
              level: classData.level,
            },
            nextLevel: nextLevel || null,
            promotionType,
            targetSchoolYear: {
              id: nextSchoolYear.id,
              year: nextSchoolYear.year,
            },
            targetSemester: {
              id: nextSemester.id,
              number: nextSemester.number,
            },
            targetClassName: null,
            targetClassSuggestions: [],
            reason: 'Level berikutnya belum tersedia',
          });
        }

        targetSchoolYear = {
          id: nextSchoolYear.id,
          year: nextSchoolYear.year,
        };
        targetSemester = {
          id: nextSemester.id,
          number: nextSemester.number,
        };
        targetClassName = buildClassName(
          nextClassInfo.nextLevelCode,
          nextClassInfo.nextClassNumber,
          parsed.classChar
        );

        const targetLevelId = nextClassInfo.promotionType === 'NEXT_LEVEL'
          ? nextLevel?.id || null
          : classData.levelId;

        if (!targetLevelId) {
          return successResponse({
            eligible: true,
            totalSubjects: subjects.length,
            approvedSubjects,
            pendingSubjects,
            totalStudents,
            class: {
              id: classData.id,
              name: classData.name,
              level: classData.level,
            },
            nextLevel: nextLevel || null,
            promotionType,
            targetSchoolYear,
            targetSemester,
            targetClassName,
            targetClassSuggestions: [],
            reason: 'Target level untuk naik kelas belum tersedia',
          });
        }

        const candidateClasses = await prisma.class.findMany({
          where: {
            schoolYearId: nextSchoolYear.id,
            semesterId: nextSemester.id,
            levelId: targetLevelId,
          },
          select: {
            id: true,
            name: true,
            capacity: true,
            levelId: true,
            level: { select: { id: true, name: true, code: true, order: true, levelCount: true } },
            schoolYear: { select: { id: true, year: true } },
            semester: { select: { id: true, number: true } },
            waliKelas: { select: { id: true, name: true } },
            isActive: true,
            _count: { select: { students: true } },
          },
        });

        const matchedClasses = candidateClasses.filter((c) =>
          matchesClassIdentity(c.name, nextClassInfo.nextLevelCode, nextClassInfo.nextClassNumber, parsed.classChar)
        );

        if (matchedClasses.length === 0) {
          return successResponse({
            eligible: true,
            totalSubjects: subjects.length,
            approvedSubjects,
            pendingSubjects,
            totalStudents,
            class: {
              id: classData.id,
              name: classData.name,
              level: classData.level,
            },
            nextLevel: nextLevel || null,
            promotionType,
            targetSchoolYear,
            targetSemester,
            targetClassName,
            targetClassSuggestions: [],
            reason: `Kelas tujuan "${targetClassName}" belum tersedia untuk tahun ajaran ${nextSchoolYear.year}`,
          });
        }

        targetClassSuggestions.push(...matchedClasses);
      }
    }

    return successResponse({
      eligible,
      totalSubjects: subjects.length,
      approvedSubjects,
      pendingSubjects,
      totalStudents,
      class: {
        id: classData.id,
        name: classData.name,
        level: classData.level,
      },
      nextLevel: nextLevel || null,
      promotionType,
      targetSchoolYear,
      targetSemester,
      targetClassName,
      targetClassSuggestions,
    });
  } catch (error) {
    serverError('Promotion eligibility error:', error);
    return errorResponse('Failed to check promotion eligibility', 500);
  }
}
