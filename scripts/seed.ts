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

  console.log('Database cleaned successfully!');

  // Create School (required for users)
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

  // Create Users (Admin, Teachers & Wali Kelas)
  console.log('Creating users...');
  const adminPassword = await hashPassword('password123');
  const teacherPassword = await hashPassword('password123');

  // Create Admin
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

  // Create Teachers
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

  // Create Wali Kelas Users
  const waliKelasUsers = await Promise.all([
    prisma.user.create({
      data: {
        email: 'walikelas1@sekolah.id',
        name: 'Ibu Siti (Wali Kelas)',
        password: teacherPassword,
        role: 'WALI_KELAS',
        schoolId: school.id,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'walikelas2@sekolah.id',
        name: 'Pak Ahmad (Wali Kelas)',
        password: teacherPassword,
        role: 'WALI_KELAS',
        schoolId: school.id,
        isActive: true,
      },
    }),
  ]);

  console.log('✅ Database seeding completed successfully!');
  console.log('\n📋 Test Credentials:');
  console.log('─────────────────────────────────────');
  console.log('Admin:');
  console.log('  Email: admin@sekolah.id');
  console.log('  Password: password123');
  console.log('');
  console.log('Teacher 1:');
  console.log('  Email: guru1@sekolah.id');
  console.log('  Password: password123');
  console.log('');
  console.log('Teacher 2:');
  console.log('  Email: guru2@sekolah.id');
  console.log('  Password: password123');
  console.log('');
  console.log('Wali Kelas 1:');
  console.log('  Email: walikelas1@sekolah.id');
  console.log('  Password: password123');
  console.log('');
  console.log('Wali Kelas 2:');
  console.log('  Email: walikelas2@sekolah.id');
  console.log('  Password: password123');
  console.log('─────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
