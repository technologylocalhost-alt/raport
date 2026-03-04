import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { extractAccessToken } from '@/lib/auth/token-extractor';
import { parseClassName, calculateNextClass } from '@/lib/class-promotion';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';

async function verifyAdmin(req: NextRequest) {
  const token = extractAccessToken(req);
  if (!token) return null;
  const payload = verifyAccessToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL')) return user;
  return null;
}

const promoteSchema = z.object({
  targetClassId: z.string().min(1, 'Target class ID is required').optional(),
  promoteStudentIds: z.array(z.string()).optional(),
  studentAssignments: z.array(z.object({
    studentId: z.string(),
    targetClassId: z.string(),
  })).optional(),
  retainStudentIds: z.array(z.string()).optional().default([]),
}).refine(
  (data) => {
    // Harus punya salah satu: old format (targetClassId + promoteStudentIds) atau new format (studentAssignments)
    const hasOldFormat = data.targetClassId && data.promoteStudentIds && data.promoteStudentIds.length > 0;
    const hasNewFormat = data.studentAssignments && data.studentAssignments.length > 0;
    return hasOldFormat || hasNewFormat;
  },
  { message: 'Provide either old format (targetClassId + promoteStudentIds) or new format (studentAssignments)' }
);

/**
 * POST /api/admin/classes/[id]/promote
 * Proses naik kelas: pindahkan siswa terpilih ke kelas baru (level berikutnya)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceClassId } = await params;
    const admin = await verifyAdmin(request);
    if (!admin) return errorResponse('Unauthorized', 401);

    const body = await request.json();
    const parsed = promoteSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Validation error', 400, parsed.error.issues);
    }

    // Identify format: old atau new
    const { targetClassId, promoteStudentIds, studentAssignments, retainStudentIds } = parsed.data;
    const isNewFormat = !!studentAssignments && studentAssignments.length > 0;
    
    // Konversi new format ke old format jika perlu (untuk backward compatibility)
    let actualTargetClassId = targetClassId;
    let actualPromoteStudentIds = promoteStudentIds || [];
    let studentToTargetClassMap: Record<string, string> = {};
    
    if (isNewFormat && studentAssignments) {
      // New format: check all students punya valid targetClassId
      const invalidAssignments = studentAssignments.filter(a => !a.studentId || !a.targetClassId);
      if (invalidAssignments.length > 0) {
        return errorResponse('Setiap siswa harus memiliki studentId dan targetClassId', 400);
      }
      
      // Build map dari studentId ke targetClassId
      studentAssignments.forEach(a => {
        studentToTargetClassMap[a.studentId] = a.targetClassId;
      });
      actualPromoteStudentIds = studentAssignments.map(a => a.studentId);
    }

    // Ambil data kelas sumber
    const sourceClass = await prisma.class.findUnique({
      where: { id: sourceClassId },
      include: {
        level: true,
        semester: true,
        students: { select: { id: true, name: true } },
        subjects: {
          include: { subject: { select: { id: true, name: true } } },
        },
      },
    });

    if (!sourceClass) return errorResponse('Source class not found', 404);

    // Ambil data kelas tujuan
    let targetClasses: any[] = [];
    let targetClassIds: string[] = [];
    
    if (isNewFormat && studentAssignments) {
      // Fetch semua unique target classes
      const uniqueTargetIds = [...new Set(studentAssignments.map(a => a.targetClassId))];
      targetClassIds = uniqueTargetIds;
      targetClasses = await prisma.class.findMany({
        where: { id: { in: uniqueTargetIds } },
        include: {
          level: true,
          semester: true,
          _count: { select: { students: true } },
        },
      });
      
      if (targetClasses.length === 0) {
        return errorResponse('Target classes tidak ditemukan', 404);
      }
      
      // Validasi bahwa semua target classes berada di level yang sama
      const uniqueLevelIds = new Set(targetClasses.map(c => c.levelId));
      if (uniqueLevelIds.size > 1) {
        return errorResponse('Semua kelas tujuan harus berada di level yang sama', 400);
      }
    } else {
      // Old format - single target class
      const targetClass = await prisma.class.findUnique({
        where: { id: actualTargetClassId! },
        include: {
          level: true,
          semester: true,
          _count: { select: { students: true } },
        },
      });
      
      if (!targetClass) return errorResponse('Target class not found', 404);
      targetClasses = [targetClass];
      targetClassIds = [actualTargetClassId!];
    }

    // Validasi dengan intelligent class promotion logic
    // Parse source class name untuk extract level number
    const sourceParsed = parseClassName(sourceClass.name);
    if (!sourceParsed) {
      return errorResponse(
        `Nama kelas sumber "${sourceClass.name}" tidak sesuai format (harus: "NUMBERCHAR", contoh: "1B" atau "MTS 1B")`,
        400
      );
    }

    // Ensure levelCode is set from actual level if not parsed from class name
    if (!sourceParsed.levelCode) {
      sourceParsed.levelCode = sourceClass.level.code;
    }

    // Use first target class for validation purposes
    const targetClass = targetClasses[0];
    
    // Deteksi tipe promosi berdasarkan target (semester atau level)
    const targetParsed = parseClassName(targetClass.name);
    if (targetParsed && !targetParsed.levelCode) {
      targetParsed.levelCode = targetClass.level.code;
    }

    const isSemesterProgression = 
      targetParsed &&
      targetParsed.levelCode === sourceParsed.levelCode &&
      targetParsed.levelNumber === sourceParsed.levelNumber &&
      targetClass.semesterId !== sourceClass.semesterId;

    const isLevelProgression =
      targetParsed &&
      (targetParsed.levelCode !== sourceParsed.levelCode ||
       targetParsed.levelNumber !== sourceParsed.levelNumber);

    // Get next level jika ada (untuk level progression validation)
    let nextLevel = null;
    if (!isSemesterProgression) {
      nextLevel = await prisma.level.findFirst({
        where: {
          schoolId: sourceClass.level.schoolId,
          order: sourceClass.level.order + 1,
        },
        select: { id: true, code: true, order: true, levelCount: true },
      });
    }

    // Calculate next class yang seharusnya (untuk level progression)
    let nextClassInfo = null;
    if (!isSemesterProgression) {
      nextClassInfo = calculateNextClass(
        sourceParsed,
        {
          code: sourceClass.level.code,
          levelCount: sourceClass.level.levelCount || 0,
          order: sourceClass.level.order,
        },
        nextLevel
          ? {
              code: nextLevel.code,
              levelCount: nextLevel.levelCount || 0,
              order: nextLevel.order,
            }
          : null
      );

      if (!nextClassInfo) {
        return errorResponse(
          `Siswa di kelas "${sourceClass.name}" sudah mencapai level tertinggi dan tidak bisa naik kelas`,
          400
        );
      }
    }

    // Validasi bahwa target class sesuai dengan promotion rules
    if (!targetParsed) {
      return errorResponse(
        `Nama kelas tujuan "${targetClass.name}" tidak sesuai format (harus: "NUMBERCHAR", contoh: "1B")`,
        400
      );
    }
    
    if (!isSemesterProgression && !isLevelProgression) {
      return errorResponse(
        `Kelas tujuan "${targetClass.name}" tidak sesuai. Target harus berupa: \n1) Kelas yang sama tapi semester berbeda (promotion dalam level), atau \n2) Kelas yang berbeda sesuai sistem naik kelas.`,
        400
      );
    }
    
    // Validasi Level Progression: hanya dari semester akhir
    if (isLevelProgression) {
      // Get total semesters per year
      const totalSems = await prisma.semester.count({
        where: { schoolYearId: sourceClass.schoolYearId }
      });
      if (sourceClass.semester.number !== totalSems) {
        return errorResponse(
          `Naik ke kelas berbeda hanya bisa dilakukan dari semester akhir. Saat ini siswa berada di semester ${sourceClass.semester.number}. Lanjutkan ke semester ${totalSems} terlebih dahulu.`,
          400
        );
      }
      
      // Validasi level progression sesuai calculated next class
      if (!nextClassInfo) {
        return errorResponse(
          `Siswa di kelas "${sourceClass.name}" sudah mencapai level tertinggi dan tidak bisa naik kelas`,
          400
        );
      }
      
      if (
        targetParsed.levelCode !== nextClassInfo.nextLevelCode ||
        targetParsed.levelNumber !== nextClassInfo.nextClassNumber
      ) {
        const expectedClassName = `${nextClassInfo.nextLevelCode} ${nextClassInfo.nextClassNumber}${sourceParsed.classChar}`;
        return errorResponse(
          `Kelas tujuan "${targetClass.name}" tidak sesuai. Berdasarkan sistem naik kelas, kelas tujuan yang valid adalah "${expectedClassName}" setelah semester akhir.`,
          400
        );
      }
    }


    // Validasi: kapasitas kelas tujuan
    if (isNewFormat && studentAssignments) {
      // Validate capacity per target class
      for (const assignment of studentAssignments) {
        const targetCls = targetClasses.find(c => c.id === assignment.targetClassId);
        if (!targetCls) continue;
        
        const studentsForThisClass = studentAssignments.filter(a => a.targetClassId === assignment.targetClassId).length;
        const currentCount = targetCls._count.students;
        if (currentCount + studentsForThisClass > targetCls.capacity) {
          return errorResponse(
            `Kapasitas kelas tujuan "${targetCls.name}" tidak mencukupi. Kapasitas: ${targetCls.capacity}, sudah terisi: ${currentCount}, akan ditambah: ${studentsForThisClass}`,
            400
          );
        }
      }
    } else {
      // Old format - single target class
      const currentTargetCount = targetClass._count.students;
      if (currentTargetCount + actualPromoteStudentIds.length > targetClass.capacity) {
        return errorResponse(
          `Kapasitas kelas tujuan tidak mencukupi. Kapasitas: ${targetClass.capacity}, sudah terisi: ${currentTargetCount}, akan ditambah: ${actualPromoteStudentIds.length}`,
          400
        );
      }
    }

    // Validasi: semua promoteStudentIds harus berasal dari kelas sumber
    const sourceStudentIds = new Set(sourceClass.students.map((s: { id: string }) => s.id));
    const invalidStudents = actualPromoteStudentIds.filter((id) => !sourceStudentIds.has(id));
    if (invalidStudents.length > 0) {
      return errorResponse(
        `Beberapa siswa tidak berasal dari kelas sumber: ${invalidStudents.join(', ')}`,
        400
      );
    }

    // Gate server-side: cek semua mata pelajaran sudah di-approve
    const totalStudents = sourceClass.students.length;
    const studentIds = sourceClass.students.map((s: { id: string }) => s.id);
    const subjects = sourceClass.subjects.map((cs: { subject: { id: string; name: string } }) => cs.subject);

    if (subjects.length === 0) {
      return errorResponse('Kelas tidak memiliki mata pelajaran terdaftar', 400);
    }

    const pendingSubjects: string[] = [];
    for (const subject of subjects) {
      const approvedStudentIds = await prisma.nilaiApprove.findMany({
        where: { studentId: { in: studentIds }, subjectId: subject.id },
        select: { studentId: true },
        distinct: ['studentId'],
      });
      if (approvedStudentIds.length < totalStudents) {
        pendingSubjects.push(subject.name);
      }
    }

    if (pendingSubjects.length > 0) {
      return errorResponse(
        `Nilai belum di-approve untuk semua siswa pada mata pelajaran: ${pendingSubjects.join(', ')}. Semua mata pelajaran harus sudah di-approve sebelum naik kelas.`,
        422
      );
    }

    // Eksekusi: duplikasi siswa yang dipromosikan ke kelas baru
    // 1. Fetch semua students yang akan dipromosikan dengan data lengkap
    const studentsToPromote = await prisma.student.findMany({
      where: { id: { in: actualPromoteStudentIds } },
      include: {
        grades: {
          select: {
            score: true,
            scoringType: true,
          },
        },
      },
    });

    // 2. Calculate rata-rata nilai untuk setiap student dan sort dari tertinggi ke terendah
    const studentsWithScores = studentsToPromote.map((student) => {
      // Parse scores dan hitung rata-rata
      let totalScore = 0;
      let scoreCount = 0;

      for (const grade of student.grades) {
        // Handle berbagai tipe scoring: numeric (0-100), string (A-D), dll
        const scoreNum = parseFloat(grade.score);
        if (!isNaN(scoreNum)) {
          totalScore += scoreNum;
          scoreCount++;
        }
      }

      const avgScore = scoreCount > 0 ? totalScore / scoreCount : 0;

      return {
        ...student,
        avgScore,
      };
    });

    // Sort dari nilai tertinggi ke terendah (hanya untuk old format)
    if (!isNewFormat) {
      studentsWithScores.sort((a, b) => b.avgScore - a.avgScore);
    }

    // 3. Create duplikat students di kelas baru dengan urutan berdasarkan nilai
    // Nomor siswa (studentNo) tetap sama, hanya nourut yang berdasarkan ranking nilai
    const createdStudents = [];
    
    if (isNewFormat && studentAssignments) {
      // New format: assign students to their respective target classes
      // Group students by target class
      const studentsByTargetClass: Record<string, any[]> = {};
      for (const student of studentsWithScores) {
        const targetCls = studentToTargetClassMap[student.id];
        if (!studentsByTargetClass[targetCls]) {
          studentsByTargetClass[targetCls] = [];
        }
        studentsByTargetClass[targetCls].push(student);
      }
      
      // For each target class, create students with nourut based on their order within that class
      for (const [targetCls, studentsInClass] of Object.entries(studentsByTargetClass)) {
        for (let i = 0; i < studentsInClass.length; i++) {
          const student = studentsInClass[i];
          
          const newStudent = await prisma.student.create({
            data: {
              classId: targetCls,
              studentNo: student.studentNo,
              name: student.name,
              nourut: i + 1, // urutan per kelas target
              email: student.email,
              phone: student.phone,
              gender: student.gender,
              birthDate: student.birthDate,
              address: student.address,
              parentPhoneNo: student.parentPhoneNo,
            },
          });
          createdStudents.push(newStudent);
        }
      }
    } else {
      // Old format: assign all students to single target class
      studentsWithScores.sort((a, b) => b.avgScore - a.avgScore);
      
      for (let i = 0; i < studentsWithScores.length; i++) {
        const student = studentsWithScores[i];

        const newStudent = await prisma.student.create({
          data: {
            classId: actualTargetClassId!,
            studentNo: student.studentNo, // Tetap nomor siswa original
            name: student.name,
            nourut: i + 1, // urutan berdasarkan ranking nilai (tertinggi ke terendah)
            email: student.email,
            phone: student.phone,
            gender: student.gender,
            birthDate: student.birthDate,
            address: student.address,
            parentPhoneNo: student.parentPhoneNo,
          },
        });

        createdStudents.push(newStudent);
      }
    }

    // 4. Deaktifkan kelas sumber setelah promosi berhasil
    await prisma.class.update({
      where: { id: sourceClassId },
      data: { isActive: false, updatedAt: new Date() },
    });

    const promotionResult = {
      promoted: createdStudents.length,
      retained: retainStudentIds.length,
      targetClass: {
        id: targetClass.id,
        name: targetClass.name,
        level: targetClass.level.name,
      },
      sourceClass: {
        id: sourceClass.id,
        name: sourceClass.name,
        level: sourceClass.level.name,
        status: 'Kelas telah dinonaktifkan',
      },
      promotiondDetails: {
        message: 'Data siswa di kelas lama tetap dipertahankan untuk keakuratan history. Kelas sumber telah dinonaktifkan.',
        orderingMethod: 'Berdasarkan ranking nilai dari tertinggi ke terendah',
      },
    };

    // Log activity
    await logActivity({
      userId: admin.id,
      action: 'CREATE',
      resourceType: 'StudentPromotion',
      resourceId: sourceClassId,
      resourceName: `Class promotion: ${sourceClass.name} → ${targetClass.name}`,
      description: `Promoted ${createdStudents.length} students from class ${sourceClass.name} (${sourceClass.level.name}) to ${targetClass.name} (${targetClass.level.name})`,
      newValue: {
        promotedCount: createdStudents.length,
        retainedCount: retainStudentIds.length,
        targetClassId: targetClass.id,
        sourceClassId: sourceClass.id,
        studentIds: createdStudents.map((s: { id: string }) => s.id),
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(
      promotionResult,
      `Berhasil memproses naik kelas: ${createdStudents.length} siswa duplikat ke ${targetClass.name} (${targetClass.level.name}). Kelas lama "${sourceClass.name}" telah dinonaktifkan.`
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    console.error('Promote error:', error);

    // Log failed promotion
    const token = extractAccessToken(request);
    if (token) {
      const payload = verifyAccessToken(token);
      if (payload) {
        const admin = await prisma.user.findUnique({
          where: { id: payload.userId },
        });
        if (admin) {
          await logActivity({
            userId: admin.id,
            action: 'CREATE',
            resourceType: 'StudentPromotion',
            description: 'Failed to process class promotion',
            ipAddress: getClientIp(request),
            userAgent: getUserAgent(request),
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return errorResponse('Failed to process class promotion', 500);
  }
}
