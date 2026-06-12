import { prisma } from '@/lib/db';

export async function getNextSchoolYearForPromotion(
  schoolId: string,
  currentSchoolYearStartDate: Date
) {
  return prisma.schoolYear.findFirst({
    where: {
      schoolId,
      startDate: {
        gt: currentSchoolYearStartDate,
      },
    },
    orderBy: {
      startDate: 'asc',
    },
    select: {
      id: true,
      year: true,
      startDate: true,
    },
  });
}

export async function getSemesterByNumber(schoolYearId: string, number: number) {
  return prisma.semester.findFirst({
    where: {
      schoolYearId,
      number,
    },
    select: {
      id: true,
      number: true,
    },
  });
}
