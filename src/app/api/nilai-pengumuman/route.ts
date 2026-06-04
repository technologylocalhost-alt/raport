/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { serverError } from '@/lib/server-log';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const schoolId = searchParams.get('schoolId');

    // Get active school year
    const activeSchoolYear = await prisma.schoolYear.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeSchoolYear) {
      return NextResponse.json({
        success: true,
        data: {},
        schools: [],
        message: 'Tidak ada tahun ajaran yang aktif',
      });
    }

    // Get all schools
    const schools = await prisma.school.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    // Build filter
    const where: any = {};
    if (schoolId) {
      where.class = {
        schoolYear: {
          schoolYearId: activeSchoolYear.id,
        },
      };
      // Actually we need to filter by school through class
    }

    // Get approved grades from active school year
    const nilaiApprove = await prisma.nilaiApprove.findMany({
      include: {
        student: {
          select: {
            id: true,
            name: true,
            studentNo: true,
            nourut: true,
            class: {
              select: {
                id: true,
                name: true,
                schoolYear: {
                  select: {
                    id: true,
                    year: true,
                  },
                },
              },
            },
          },
        },
        class: {
          include: {
            schoolYear: {
              select: {
                id: true,
                year: true,
              },
            },
            level: {
              select: {
                id: true,
                name: true,
                school: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      take: 10000,
    });

    // Filter by active school year
    const filteredData = nilaiApprove.filter(
      item => item.class.schoolYear?.id === activeSchoolYear.id
    );

    // Filter by school if specified
    const finalData = schoolId
      ? filteredData.filter(item => item.class.level?.school?.id === schoolId)
      : filteredData;

    // Group by school first, then by class and student
    const groupedBySchool = finalData.reduce((acc: any, curr) => {
      const schoolName = curr.class.level?.school?.name || 'Tidak Diketahui';
      const schoolId = curr.class.level?.school?.id || 'unknown';
      const className = curr.class?.name || 'Tidak Diketahui';
      const studentKey = curr.studentId;

      // Initialize school group
      if (!acc[schoolName]) {
        acc[schoolName] = {
          schoolId,
          classes: {},
        };
      }

      // Initialize class group
      if (!acc[schoolName].classes[className]) {
        acc[schoolName].classes[className] = {};
      }

      // Initialize student in class
      if (!acc[schoolName].classes[className][studentKey]) {
        acc[schoolName].classes[className][studentKey] = {
          id: curr.student.id,
          name: curr.student.name,
          studentNo: curr.student.studentNo,
          nourut: curr.student.nourut,
          class: curr.student.class,
          mulahazoh: curr.mulahazoh,
          scores: [],
        };
      }

      // Add score
      const scoreNum = parseFloat(curr.score) || 0;
      acc[schoolName].classes[className][studentKey].scores.push(scoreNum);

      return acc;
    }, {});

    // Process and sort each school/class/student
    const result: any = {};
    Object.entries(groupedBySchool).forEach(([schoolName, schoolData]: any) => {
      result[schoolName] = {};

      Object.entries(schoolData.classes).forEach(([className, students]: any) => {
        // Convert students object to array with calculated average
        const studentArray = Object.values(students).map((item: any) => {
          const average = item.scores.length > 0
            ? (item.scores.reduce((a: number, b: number) => a + b, 0) / item.scores.length).toFixed(2)
            : '0';
          return {
            ...item,
            average: parseFloat(average),
            scores: undefined,
          };
        });

        // Sort by average (highest first)
        studentArray.sort((a: any, b: any) => b.average - a.average);
        result[schoolName][className] = studentArray;
      });
    });

    return NextResponse.json({
      success: true,
      schoolYear: activeSchoolYear,
      data: result,
      schools: schools,
      total: finalData.length,
    });
  } catch (error) {
    serverError('Error fetching approved grades:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch approved grades' },
      { status: 500 }
    );
  }
}
