import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { logActivity, logBulkActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';

const approveGradesSchema = z.object({
  subjectId: z.string().min(1, 'Subject ID is required'),
  classId: z.string().min(1, 'Class ID is required'),
  nomorRaport: z.string().optional(),
  suluk: z.string().optional(),
  muazobah: z.string().optional(),
  nazofah: z.string().optional(),
});

type ApproveGradesInput = z.infer<typeof approveGradesSchema>;

async function getUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (user?.role === 'WALI_KELAS') {
    return user;
  }
  return null;
}

/**
 * POST /api/wali-kelas/grades-for-approval
 * Approve grades for a subject+class and save to nilai_approve table
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[ApproveGrades] === START APPROVAL REQUEST ===');
    
    const user = await getUser(request);
    console.log('[ApproveGrades] User auth check:', user ? `User ID: ${user.id}, Role: ${user.role}` : 'NOT AUTHENTICATED');
    
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    console.log('[ApproveGrades] Request body:', JSON.stringify(body, null, 2));
    
    const validatedData = approveGradesSchema.parse(body);
    console.log('[ApproveGrades] Validated data:', validatedData);

    // Verify that the wali-kelas owns this class
    const classData = await prisma.class.findFirst({
      where: {
        id: validatedData.classId,
        waliKelasId: user.id,
      },
    });

    console.log('[ApproveGrades] Class check:', classData ? `Found class: ${classData.name}` : 'CLASS NOT FOUND');
    
    if (!classData) {
      return errorResponse('Class not found or unauthorized', 404);
    }

    // Get all grades for this subject+class with full student/semester info
    const grades = await prisma.grade.findMany({
      where: {
        student: {
          classId: validatedData.classId,
        },
        subjectId: validatedData.subjectId,
      },
      include: {
        student: {
          include: {
            class: {
              include: {
                schoolYear: true,
                semester: true,
              },
            },
          },
        },
        subject: true,
        competency: true,
        teacher: true,
      },
    });

    console.log('[ApproveGrades] Grade query executed');
    console.log('[ApproveGrades] Query criteria - classId:', validatedData.classId, 'subjectId:', validatedData.subjectId);
    console.log('[ApproveGrades] Grades returned from query:', grades.length);
    
    if (grades.length > 0) {
      console.log('[ApproveGrades] First grade details:', {
        id: grades[0].id,
        studentId: grades[0].studentId,
        subjectId: grades[0].subjectId,
        assessmentType: grades[0].assessmentType,
        score: grades[0].score,
      });
    }
    
    if (grades.length === 0) {
      return errorResponse('No grades found for this subject and class', 404);
    }

    // Get unique assessmentTypes from the grades being approved
    const assessmentTypes = [...new Set(grades.map(g => g.assessmentType))];
    console.log('[ApproveGrades] Assessment types found:', assessmentTypes);

    // Check if this subject+class+assessmentType combination has already been approved
    const existingApprovals = await prisma.nilaiApprove.findMany({
      where: {
        subjectId: validatedData.subjectId,
        assessmentType: {
          in: assessmentTypes,
        },
        student: {
          classId: validatedData.classId,
        },
      },
      select: {
        id: true,
        studentId: true,
        assessmentType: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 1,
    });

    console.log('[ApproveGrades] Existing approvals check:', existingApprovals.length > 0 ? 'FOUND - DUPLICATE' : 'NOT FOUND - OK');

    if (existingApprovals.length > 0) {
      const firstApproval = existingApprovals[0];
      const msg = `Penilaian ${firstApproval.assessmentType} untuk mata pelajaran ini sudah pernah disetujui pada ${new Date(
        firstApproval.updatedAt || firstApproval.createdAt
      ).toLocaleString('id-ID')}. Tidak dapat disetujui ulang.`;
      console.log('[ApproveGrades] 409 Conflict:', msg);
      return errorResponse(msg, 409);
    }

    // Get level and semester info from first grade
    const levelId = grades[0].levelId || '';
    const schoolYear = grades[0].student.class.schoolYear;
    const semester = grades[0].student.class.semester;
    
    // Helper function to translate assessmentType to Indonesian code
    const getAssessmentTypeCode = (type: string): string => {
      const mapping: { [key: string]: string } = {
        UTS_1: 'UTS1',
        UAS_1: 'UAS1',
        UTS_2: 'UTS2',
        UAS_2: 'UAS2',
        FINAL_EXAM_1: 'FE1',
        FINAL_EXAM_2: 'FE2',
      };
      return mapping[type] || type;
    };

    // Helper function to get Mulahazoh based on average
    const getMulahazoh = (average: number): string => {
      if (average < 3.5) return 'ضعيف جدّا';
      if (average < 5.5) return 'ضعيف';
      if (average < 6.5) return 'مقبول';
      if (average < 8.0) return 'جيّد';
      if (average < 9.0) return 'جيّد جدّا';
      return 'ممتاز';
    };

    // Build nomorRaport mapping: key = `${assessmentType}-${studentId}`, value = nomorRaport
    const nomorRaportMap: { [key: string]: string } = {};

    // Get all students in class sorted
    const studentsInClass = await prisma.student.findMany({
      where: { classId: validatedData.classId },
      orderBy: [
        { nourut: { sort: 'asc', nulls: 'last' } },
        { studentNo: 'asc' },
      ],
    });

    // Get unique assessment types from grades
    const uniqueAssessmentTypesInGrades = [...new Set(grades.map((g) => g.assessmentType))];

    // Helper function to extract number from nomorRaport (e.g., "UTS1-25/26-PA-0021" → 21)
    const extractNomorFromRaport = (nomorRaport: string | null | undefined): number => {
      if (!nomorRaport) return 0;
      const parts = nomorRaport.split('-');
      const lastPart = parts[parts.length - 1];
      const num = parseInt(lastPart, 10);
      return isNaN(num) ? 0 : num;
    };

    // Initialize counters by querying existing max nomorRaport for each (assessmentType, gender) combo
    // This ensures continuous numbering across classes
    const genderCounters: { [key: string]: number } = {}; // key = `${assessmentType}-${gender}`

    for (const assessmentType of uniqueAssessmentTypesInGrades) {
      for (const genderCode of ['PA', 'PI']) {
        const counterKey = `${assessmentType}-${genderCode}`;

        // Query max existing nomorRaport for this (assessmentType, gender) combo
        const maxExisting = await prisma.nilaiApprove.findFirst({
          where: {
            assessmentType: assessmentType,
            nomorRaport: {
              contains: `-${genderCode}-`,
            },
          },
          select: { nomorRaport: true },
          orderBy: { createdAt: 'desc' },
        });

        // Extract the number and start from max + 1
        const maxNumber = extractNomorFromRaport(maxExisting?.nomorRaport);
        genderCounters[counterKey] = maxNumber + 1;

        console.log(`[ApproveGrades] Counter ${counterKey}: starting from ${genderCounters[counterKey]} (max existing was ${maxNumber})`);
      }
    }

    // Now process students and assign nomorRaport
    // IMPORTANT: Only assign nomorRaport for students who actually have grades in this subject
    for (const student of studentsInClass) {
      // Get unique assessmentTypes for this student in the grades
      const studentGrades = grades.filter((g) => g.studentId === student.id);
      
      // Skip if student has no grades in this subject
      if (studentGrades.length === 0) {
        console.log(`[ApproveGrades] Skipping nomorRaport assignment for student ${student.id} (no grades in this subject)`);
        continue;
      }
      
      const uniqueAssessmentTypes = [...new Set(studentGrades.map((g) => g.assessmentType))];

      for (const assessmentType of uniqueAssessmentTypes) {
        const genderCode = student.gender === 'MALE' ? 'PA' : 'PI';
        const counterKey = `${assessmentType}-${genderCode}`;

        const assessmentCode = getAssessmentTypeCode(assessmentType);
        const nomorUrut = String(genderCounters[counterKey]).padStart(4, '0');
        const yearNum = parseInt(schoolYear?.year || '0');
        const tahunAjaranFormatted = `${String(yearNum).slice(-2)}/${String(yearNum + 1).slice(-2)}`;

        const nomorRaport = `${assessmentCode}-${tahunAjaranFormatted}-${genderCode}-${nomorUrut}`;
        nomorRaportMap[`${assessmentType}-${student.id}`] = nomorRaport;

        // Increment counter for next student
        genderCounters[counterKey]++;
      }
    }

    // Copy to nilai_approve table
    const createdApprovals = [];
    const skippedGrades = [];
    const failedGrades = [];

    console.log('[ApproveGrades] Starting to create approvals - Total grades to process:', grades.length);

    for (let i = 0; i < grades.length; i++) {
      const grade = grades[i];
      
      try {
        // Check if this exact subject+student+assessmentType combination already exists
        // (to avoid duplicates for the same subject)
        const existingForThisSubject = await prisma.nilaiApprove.findFirst({
          where: {
            studentId: grade.studentId,
            subjectId: validatedData.subjectId,
            assessmentType: grade.assessmentType,
            classId: validatedData.classId,
          },
          select: {
            id: true,
            nomorRaport: true,
          },
        });

        // Check if student already has a nomorRaport for this assessment type (from ANY subject)
        // This is to reuse the same nomorRaport across different subjects for same assessment type
        const existingNomorRaportForAssessment = await prisma.nilaiApprove.findFirst({
          where: {
            studentId: grade.studentId,
            assessmentType: grade.assessmentType,
            classId: validatedData.classId,
            // NO subjectId filter - we want to find from ANY subject
          },
          select: {
            nomorRaport: true,
          },
        });

        // Determine nomorRaport: reuse if exists for this assessmentType, or generate new
        let finalNomorRaport: string;
        if (existingNomorRaportForAssessment?.nomorRaport) {
          // Reuse existing nomorRaport from same assessment type (different subject OK)
          finalNomorRaport = existingNomorRaportForAssessment.nomorRaport;
          console.log(`[ApproveGrades] Reusing nomorRaport for student ${grade.studentId} (assessment ${grade.assessmentType}): ${finalNomorRaport}`);
        } else {
          // Generate new nomorRaport only if no approval for this assessmentType exists
          const mapKey = `${grade.assessmentType}-${grade.studentId}`;
          const autoGeneratedNomorRaport = nomorRaportMap[mapKey] || '';
          finalNomorRaport = validatedData.nomorRaport || autoGeneratedNomorRaport;
          console.log(`[ApproveGrades] Generated new nomorRaport for student ${grade.studentId}: ${finalNomorRaport}`);
        }

        // If this exact subject+student combo was already approved, delete old record
        if (existingForThisSubject) {
          await prisma.nilaiApprove.delete({
            where: { id: existingForThisSubject.id },
          });
          console.log(`[ApproveGrades] Deleted old approval record for student ${grade.studentId} (subject: ${validatedData.subjectId})`);
        }

        // Calculate averageStudent - rata-rata nilai siswa across all subjects
        const studentAllGrades = await prisma.grade.findMany({
          where: {
            studentId: grade.studentId,
            assessmentType: grade.assessmentType,
          },
          include: {
            competency: true,
          },
        });

        let averageStudent = 0;
        let jumlahNilai = 0;
        if (studentAllGrades.length > 0) {
          const numericScores = studentAllGrades
            .map((g) => {
              const numScore = parseFloat(g.score);
              return isNaN(numScore) ? 0 : numScore;
            })
            .filter((s) => s > 0);
          
          if (numericScores.length > 0) {
            averageStudent = numericScores.reduce((a, b) => a + b, 0) / numericScores.length;
            jumlahNilai = numericScores.reduce((a, b) => a + b, 0);
          }
        }

        // Calculate averageSubject - rata-rata untuk subject ini across all students
        let averageSubject = 0;
        if (grades.length > 0) {
          const numericSubjectScores = grades
            .map((g) => {
              const numScore = parseFloat(g.score);
              return isNaN(numScore) ? 0 : numScore;
            })
            .filter((s) => s > 0);
          
          if (numericSubjectScores.length > 0) {
            averageSubject = numericSubjectScores.reduce((a, b) => a + b, 0) / numericSubjectScores.length;
          }
        }

        // Round average to 1 decimal place
        const roundedAverage = Math.round(averageStudent * 10) / 10;
        const mulahazoh = getMulahazoh(roundedAverage);

        const approval = await prisma.nilaiApprove.create({
          data: {
            studentId: grade.studentId,
            classId: grade.student.classId,
            competencyId: grade.competencyId,
            subjectId: validatedData.subjectId,
            levelId: levelId,
            teacherId: grade.teacherId,
            score: grade.score,
            scoringType: grade.scoringType || 'NUMERIC',
            assessmentType: grade.assessmentType,
            notes: grade.notes,
            nomorRaport: finalNomorRaport,
            suluk: validatedData.suluk || '',
            muazobah: validatedData.muazobah || '',
            nazofah: validatedData.nazofah || '',
            averageStudent: averageStudent > 0 ? averageStudent : null,
            averageSubject: averageSubject > 0 ? averageSubject : null,
            jumlahNilai: jumlahNilai > 0 ? jumlahNilai : null,
            mulahazoh: mulahazoh || null,
          },
        });

        createdApprovals.push(approval);
      } catch (err: any) {
        console.error(`[ApproveGrades] Error for student ${grade.studentId}:`, err.message);
        failedGrades.push({
          studentId: grade.studentId,
          error: err.message,
        });
      }
    }

    console.log(`[ApproveGrades] Completed - Created: ${createdApprovals.length}, Skipped: ${skippedGrades.length}, Failed: ${failedGrades.length}`);

    // Log bulk approval activity (background task - doesn't block response)
    const userId = user.id; // Save for background task
    const subjectName = grades[0]?.subject?.name || 'Unknown Subject';
    const className = classData?.name || 'Unknown Class';

    (async () => {
      try {
        await logBulkActivity(
          userId,
          'APPROVE',
          'Grades',
          `Approved grades for subject ${subjectName}`,
          grades.length,
          createdApprovals.length,
          getClientIp(request),
          getUserAgent(request)
        );
      } catch (err) {
        console.error('Error logging approval activity:', err);
      }
    })();

    const responseData = {
      message: `Approved ${createdApprovals.length} grades for ${subjectName} in ${className}`,
      count: createdApprovals.length,
      totalGrades: grades.length,
    };
    
    console.log('[ApproveGrades] === SUCCESS ===');
    console.log('[ApproveGrades] Response:', JSON.stringify(responseData, null, 2));

    return successResponse(responseData, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      console.error('[ApproveGrades] Validation error:', fieldErrors);
      return errorResponse('Validation error', 400, fieldErrors);
    }
    console.error('[ApproveGrades] === ERROR ===:', error);
    return errorResponse('Failed to approve grades', 500);
  }
}
