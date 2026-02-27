import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { extractAccessToken } from '@/lib/auth/token-extractor';
import { parseClassName, calculateNextClass, findTargetClass, getPossibleTargetClasses } from '@/lib/class-promotion';

async function verifyAdmin(req: NextRequest) {
  const token = extractAccessToken(req);
  if (!token) return null;
  const payload = verifyAccessToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL')) return user;
  return null;
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
    const admin = await verifyAdmin(request);
    if (!admin) return errorResponse('Unauthorized', 401);

    // Ambil data kelas + level + siswa
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        level: true,
        semester: true,
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

    // Cek level berikutnya
    const nextLevel = await prisma.level.findFirst({
      where: {
        schoolId: classData.level.schoolId,
        order: classData.level.order + 1,
      },
      select: { id: true, name: true, code: true, order: true, levelCount: true },
    });

    // Calculate target class suggestions berdasarkan levelCount logic
    let targetClassSuggestions: Array<{
      id: string;
      name: string;
      levelId: string;
      level: { id: string; name: string; code: string; order: number; levelCount: number };
    }> = [];

    if (eligible) {
      // Parse current class name untuk extract level number
      const parsed = parseClassName(classData.name);
      
      if (parsed) {
        // Ensure levelCode is set from actual level if not parsed from class name
        if (!parsed.levelCode) {
          parsed.levelCode = classData.level.code;
        }

        // Get semester info - tentukan next semester
        const currentSemester = classData.semester.number;
        const totalSemestersPerYear = 2; // Asumsi: 2 semester per tahun
        
        let nextSemesterId: string | null = null;
        let nextSchoolYearId = classData.schoolYearId;
        
        if (currentSemester < totalSemestersPerYear) {
          // Semester selanjutnya di tahun ajaran yang sama
          const nextSem = await prisma.semester.findFirst({
            where: {
              schoolYearId: classData.schoolYearId,
              number: currentSemester + 1,
            },
            select: { id: true },
          });
          nextSemesterId = nextSem?.id || null;
        } else {
          // Jika semester 2 (akhir tahun), ambil semester 1 tahun ajaran berikutnya
          const nextSchoolYear = await prisma.schoolYear.findFirst({
            where: {
              schoolId: classData.level.schoolId,
            },
            orderBy: { year: 'desc' },
            select: { id: true, year: true },
            take: 1,
          });
          
          if (nextSchoolYear) {
            const nextSem = await prisma.semester.findFirst({
              where: {
                schoolYearId: nextSchoolYear.id,
                number: 1,
              },
              select: { id: true },
            });
            nextSemesterId = nextSem?.id || null;
            nextSchoolYearId = nextSchoolYear.id;
          }
        }

        // TYPE 1: Semester Progression (tetap kelas, ganti semester)
        // Jika current semester < 2, suggest same class tapi semester selanjutnya
        if (currentSemester < totalSemestersPerYear && nextSemesterId) {
          const sameLevelClasses = await prisma.class.findMany({
            where: {
              schoolYearId: classData.schoolYearId,
              semesterId: nextSemesterId,
              levelId: classData.levelId,
              name: classData.name, // Sama class name
            },
            select: {
              id: true,
              name: true,
              levelId: true,
              level: { select: { id: true, name: true, code: true, order: true, levelCount: true } },
            },
          });
          targetClassSuggestions.push(...sameLevelClasses);
        }

        // TYPE 2: Level Progression (naik tingkat/kelas)
        // Hanya suggest naik tingkat jika semester saat ini adalah semester akhir (2)
        if (currentSemester === totalSemestersPerYear) {
          // Calculate next class info untuk level progression
          const nextLevel = await prisma.level.findFirst({
            where: {
              schoolId: classData.level.schoolId,
              order: classData.level.order + 1,
            },
            select: { id: true, name: true, code: true, order: true, levelCount: true },
          });

          const nextClassInfo = calculateNextClass(
            parsed,
            {
              code: classData.level.code,
              levelCount: classData.level.levelCount || 0,
              order: classData.level.order,
            },
            nextLevel
              ? {
                  code: nextLevel.code,
                  levelCount: nextLevel.levelCount || 0,
                  order: nextLevel.order,
                }
              : null
          );

          if (nextClassInfo && nextSemesterId) {
            const nextLevelClasses = await prisma.class.findMany({
              where: {
                schoolYearId: nextSchoolYearId,
                semesterId: nextSemesterId,
                levelId: nextLevel?.id,
              },
              select: {
                id: true,
                name: true,
                levelId: true,
                level: { select: { id: true, name: true, code: true, order: true, levelCount: true } },
              },
            });

            const filteredClasses = nextLevelClasses.filter((c) => {
              const classParsed = parseClassName(c.name);
              return (
                classParsed &&
                c.level.code === nextClassInfo.nextLevelCode &&
                classParsed.levelNumber === nextClassInfo.nextClassNumber
              );
            });
            targetClassSuggestions.push(...filteredClasses);
          }
        }
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
      targetClassSuggestions,
    });
  } catch (error) {
    console.error('Promotion eligibility error:', error);
    return errorResponse('Failed to check promotion eligibility', 500);
  }
}
