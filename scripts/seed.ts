import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from '../src/lib/auth/password';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting database seeding...');

  // Clean up existing data
  console.log('Cleaning up existing data...');
  await prisma.grade.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.classTeacher.deleteMany({});
  await prisma.classSubject.deleteMany({});
  await prisma.class.deleteMany({});
  await prisma.competency.deleteMany({});
  await prisma.subject.deleteMany({});
  await prisma.semester.deleteMany({});
  await prisma.reportConfig.deleteMany({});
  await prisma.level.deleteMany({});
  await prisma.schoolYear.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.school.deleteMany({});

  // Create School
  console.log('Creating school...');
  const school = await prisma.school.create({
    data: {
      name: 'SMA Negeri 1 Contoh',
      address: 'Jl. Pendidikan No. 123, Kota Contoh',
      phone: '021-1234567',
      email: 'contact@smanegeri1.id',
      npsn: '20207500',
    },
  });

  // Create Levels (Jenjang Pendidikan)
  console.log('Creating educational levels...');
  const levelMap = await Promise.all([
    prisma.level.create({
      data: {
        schoolId: school.id,
        name: 'SMA',
        code: 'SMA',
      },
    }),
    prisma.level.create({
      data: {
        schoolId: school.id,
        name: 'SMK',
        code: 'SMK',
      },
    }),
  ]);

  // Create School Year
  console.log('Creating school year...');
  const schoolYear = await prisma.schoolYear.create({
    data: {
      schoolId: school.id,
      year: '2024/2025',
      startDate: new Date('2024-07-01'),
      endDate: new Date('2025-06-30'),
      isActive: true,
    },
  });

  // Create Semesters
  console.log('Creating semesters...');
  const semesters = await Promise.all([
    prisma.semester.create({
      data: {
        schoolYearId: schoolYear.id,
        number: 1,
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-12-31'),
        isActive: true,
      },
    }),
    prisma.semester.create({
      data: {
        schoolYearId: schoolYear.id,
        number: 2,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-06-30'),
        isActive: false,
      },
    }),
  ]);

  // Create Classes
  console.log('Creating classes...');
  const classes = await Promise.all([
    prisma.class.create({
      data: {
        levelId: levelMap[0].id,
        schoolYearId: schoolYear.id,
        semesterId: semesters[0].id,
        name: '12 IPA 1',
        capacity: 35,
      },
    }),
    prisma.class.create({
      data: {
        levelId: levelMap[0].id,
        schoolYearId: schoolYear.id,
        semesterId: semesters[0].id,
        name: '12 IPS 1',
        capacity: 36,
      },
    }),
  ]);

  // Create Users (Admin & Teachers)
  console.log('Creating users...');
  const adminPassword = await hashPassword('password123');
  const teacherPassword = await hashPassword('password123');

  const admin = await prisma.user.create({
    data: {
      email: 'admin@sekolah.id',
      name: 'Administrator',
      password: adminPassword,
      role: 'ADMIN',
      schoolId: school.id,
      isActive: true,
    },
  });

  const teachers = await Promise.all([
    prisma.user.create({
      data: {
        email: 'guru1@sekolah.id',
        name: 'Ibu Siti',
        password: teacherPassword,
        role: 'TEACHER',
        schoolId: school.id,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'guru2@sekolah.id',
        name: 'Pak Ahmad',
        password: teacherPassword,
        role: 'TEACHER',
        schoolId: school.id,
        isActive: true,
      },
    }),
  ]);

  // Create WALI_KELAS users
  const waliKelasUsers = await Promise.all([
    prisma.user.create({
      data: {
        email: 'walikelas1@sekolah.id',
        name: 'Ibu Siti',
        password: teacherPassword,
        role: 'WALI_KELAS',
        schoolId: school.id,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'walikelas2@sekolah.id',
        name: 'Pak Ahmad',
        password: teacherPassword,
        role: 'WALI_KELAS',
        schoolId: school.id,
        isActive: true,
      },
    }),
  ]);

  // Assign waliKelas to classes
  await prisma.class.update({
    where: { id: classes[0].id },
    data: { waliKelasId: waliKelasUsers[0].id },
  });

  await prisma.class.update({
    where: { id: classes[1].id },
    data: { waliKelasId: waliKelasUsers[1].id },
  });

  // Create Subjects
  console.log('Creating subjects...');
  const subjects = await Promise.all([
    prisma.subject.create({
      data: {
        levelId: levelMap[0].id,
        code: 'MTK',
        name: 'Matematika',
      },
    }),
    prisma.subject.create({
      data: {
        levelId: levelMap[0].id,
        code: 'IPA',
        name: 'Ilmu Pengetahuan Alam',
      },
    }),
    prisma.subject.create({
      data: {
        levelId: levelMap[0].id,
        code: 'IND',
        name: 'Bahasa Indonesia',
      },
    }),
  ]);

  // Create Competencies
  console.log('Creating competencies...');
  const competencies = await Promise.all([
    // Matematika
    prisma.competency.create({
      data: {
        subjectId: subjects[0].id,
        code: '3.1',
        name: 'Memahami operasi aljabar pada polinomial',
        type: 'KNOWLEDGE',
        order: 1,
      },
    }),
    prisma.competency.create({
      data: {
        subjectId: subjects[0].id,
        code: '4.1',
        name: 'Menerapkan operasi aljabar pada polinomial',
        type: 'SKILL',
        order: 2,
      },
    }),
    // IPA
    prisma.competency.create({
      data: {
        subjectId: subjects[1].id,
        code: '3.2',
        name: 'Memahami struktur atom dan ikatan kimia',
        type: 'KNOWLEDGE',
        order: 1,
      },
    }),
    prisma.competency.create({
      data: {
        subjectId: subjects[1].id,
        code: '4.2',
        name: 'Melakukan eksperimen ikatan kimia',
        type: 'SKILL',
        order: 2,
      },
    }),
  ]);

  // Create Students
  console.log('Creating students...');
  const students = await Promise.all([
    prisma.student.create({
      data: {
        classId: classes[0].id,
        studentNo: '001/XII.IPA.1/2024',
        name: 'Aldi Pratama',
        email: 'aldi.pratama@student.id',
        birthDate: new Date('2006-01-15'),
        address: 'Jl. Merdeka No. 10',
        parentPhoneNo: '081234567890',
      },
    }),
    prisma.student.create({
      data: {
        classId: classes[0].id,
        studentNo: '002/XII.IPA.1/2024',
        name: 'Budi Santoso',
        email: 'budi.santoso@student.id',
        birthDate: new Date('2006-03-20'),
        address: 'Jl. Sudirman No. 5',
        parentPhoneNo: '081234567891',
      },
    }),
    prisma.student.create({
      data: {
        classId: classes[1].id,
        studentNo: '001/XII.IPS.1/2024',
        name: 'Citra Dewi',
        email: 'citra.dewi@student.id',
        birthDate: new Date('2006-05-10'),
        address: 'Jl. Ahmad Yani No. 8',
        parentPhoneNo: '081234567892',
      },
    }),
  ]);

  // Create ClassSubjects
  console.log('Creating class subjects...');
  await Promise.all([
    prisma.classSubject.create({
      data: {
        classId: classes[0].id,
        subjectId: subjects[0].id,
      },
    }),
    prisma.classSubject.create({
      data: {
        classId: classes[0].id,
        subjectId: subjects[1].id,
      },
    }),
    prisma.classSubject.create({
      data: {
        classId: classes[1].id,
        subjectId: subjects[2].id,
      },
    }),
  ]);

  // Create ClassTeachers
  console.log('Creating class teachers...');
  await Promise.all([
    prisma.classTeacher.create({
      data: {
        classId: classes[0].id,
        teacherId: teachers[0].id,
        subjectId: subjects[0].id,
      },
    }),
    prisma.classTeacher.create({
      data: {
        classId: classes[0].id,
        teacherId: teachers[1].id,
        subjectId: subjects[1].id,
      },
    }),
    prisma.classTeacher.create({
      data: {
        classId: classes[1].id,
        teacherId: teachers[0].id,
        subjectId: subjects[2].id,
      },
    }),
  ]);

  // Create Sample Grades
  console.log('Creating sample grades...');
  await Promise.all([
    prisma.grade.create({
      data: {
        studentId: students[0].id,
        competencyId: competencies[0].id,
        levelId: levelMap[0].id,
        teacherId: teachers[0].id,
        score: '85',
        scoringType: 'NUMERIC_0_100',
        assessmentType: 'MIDTERM',
        notes: 'Good understanding of basic concepts',
      },
    }),
    prisma.grade.create({
      data: {
        studentId: students[0].id,
        competencyId: competencies[1].id,
        levelId: levelMap[0].id,
        teacherId: teachers[0].id,
        score: '80',
        scoringType: 'NUMERIC_0_100',
        assessmentType: 'MIDTERM',
        notes: 'Needs improvement in problem solving',
      },
    }),
    prisma.grade.create({
      data: {
        studentId: students[1].id,
        competencyId: competencies[0].id,
        levelId: levelMap[0].id,
        teacherId: teachers[0].id,
        score: '92',
        scoringType: 'NUMERIC_0_100',
        assessmentType: 'MIDTERM',
        notes: 'Excellent performance',
      },
    }),
  ]);

  // Create Report Config for SMA
  console.log('Creating report configurations...');
  await prisma.reportConfig.create({
    data: {
      levelId: levelMap[0].id,
      scoringType: 'NUMERIC_0_100',
      minScore: '60',
      maxScore: '100',
      includeAttitude: true,
      includeSkills: true,
      includeKnowledge: true,
      weightAttitude: 10,
      weightSkills: 45,
      weightKnowledge: 45,
    },
  });

  console.log('✅ Database seeding completed successfully!');
  console.log('\nTest Credentials:');
  console.log('Admin: admin@sekolah.id / password123');
  console.log('Teacher 1: guru1@sekolah.id / password123');
  console.log('Teacher 2: guru2@sekolah.id / password123');
  console.log('Wali Kelas 1: walikelas1@sekolah.id / password123');
  console.log('Wali Kelas 2: walikelas2@sekolah.id / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
