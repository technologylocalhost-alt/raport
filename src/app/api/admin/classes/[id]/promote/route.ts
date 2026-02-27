import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { extractAccessToken } from '@/lib/auth/token-extractor';
import { parseClassName, calculateNextClass } from '@/lib/class-promotion';

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
  targetClassId: z.string().min(1, 'Target class ID is required'),
  promoteStudentIds: z.array(z.string()).min(1, 'Minimal 1 siswa harus dipromosikan'),
  retainStudentIds: z.array(z.string()).optional().default([]),
});

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

    const { targetClassId, promoteStudentIds, retainStudentIds } = parsed.data;

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
    const targetClass = await prisma.class.findUnique({
      where: { id: targetClassId },
      include: {
        level: true,
        semester: true,
        _count: { select: { students: true } },
      },
    });

    if (!targetClass) return errorResponse('Target class not found', 404);

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
    const currentTargetCount = targetClass._count.students;
    if (currentTargetCount + promoteStudentIds.length > targetClass.capacity) {
      return errorResponse(
        `Kapasitas kelas tujuan tidak mencukupi. Kapasitas: ${targetClass.capacity}, sudah terisi: ${currentTargetCount}, akan ditambah: ${promoteStudentIds.length}`,
        400
      );
    }

    // Validasi: semua promoteStudentIds harus berasal dari kelas sumber
    const sourceStudentIds = new Set(sourceClass.students.map((s: { id: string }) => s.id));
    const invalidStudents = promoteStudentIds.filter((id) => !sourceStudentIds.has(id));
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
      where: { id: { in: promoteStudentIds } },
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

    // Sort dari nilai tertinggi ke terendah
    studentsWithScores.sort((a, b) => b.avgScore - a.avgScore);

    // 3. Create duplikat students di kelas baru dengan urutan berdasarkan nilai
    // Nomor siswa (studentNo) tetap sama, hanya nourut yang berdasarkan ranking nilai
    const createdStudents = [];
    for (let i = 0; i < studentsWithScores.length; i++) {
      const student = studentsWithScores[i];

      const newStudent = await prisma.student.create({
        data: {
          classId: targetClassId,
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

    return successResponse(
      {
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
        },
        promotiondDetails: {
          message: 'Data siswa di kelas lama tetap dipertahankan untuk keakuratan history',
          orderingMethod: 'Berdasarkan ranking nilai dari tertinggi ke terendah',
        },
      },
      `Berhasil memproses naik kelas: ${createdStudents.length} siswa duplikat ke ${targetClass.name} (${targetClass.level.name}) dengan nomor urut baru berdasarkan ranking nilai. Data siswa di kelas ${sourceClass.name} tetap dipertahankan.`
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    console.error('Promote error:', error);
    return errorResponse('Failed to process class promotion', 500);
  }
}
