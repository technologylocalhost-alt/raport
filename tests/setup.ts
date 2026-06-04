/**
 * Test Setup & Configuration
 * Setup untuk testing environment
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import jwt from 'jsonwebtoken';

// Test database URL - use environment variable
const TEST_DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/raport_test';

// Override DATABASE_URL for tests
if (process.env.NODE_ENV === 'test') {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

// Create Prisma client for tests
export const prisma = new PrismaClient();

/**
 * Setup test database before all tests
 */
export async function setupTestDatabase() {
  try {
    // Push schema to test database
    execSync('bunx prisma db push --skip-generate --force-reset', {
      env: {
        ...process.env,
        DATABASE_URL: TEST_DATABASE_URL,
      },
      stdio: 'inherit',
    });

    console.log('✅ Test database setup complete');
  } catch {
    console.warn('⚠️  Could not setup test database. Make sure PostgreSQL is running.');
    console.warn('    You can skip database tests or setup manually.');
  }
}

/**
 * Clean all data from database
 */
export async function cleanDatabase() {
  try {
    const tables = [
      'RefreshToken',
      'Grade',
      'NilaiApprove',
      'Attendance',
      'StudentNote',
      'Competency',
      'ClassSubject',
      'ClassTeacher',
      'Student',
      'Class',
      'Subject',
      'Semester',
      'SchoolYear',
      'ReportConfig',
      'Level',
      'User',
      'School',
    ];

    for (const table of tables) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    }

    console.log('🧹 Database cleaned');
  } catch {
    console.warn('⚠️  Could not clean database. Make sure test database exists.');
  }
}

/**
 * Teardown test database after all tests
 */
export async function teardownTestDatabase() {
  await prisma.$disconnect();
  console.log('👋 Test database disconnected');
}

/**
 * Create test user
 */
export async function createTestUser(data?: {
  email?: string;
  password?: string;
  name?: string;
  role?: 'ADMIN' | 'TEACHER' | 'PRINCIPAL' | 'WALI_KELAS';
}) {
  const school = await prisma.school.create({
    data: {
      name: 'Test School',
      address: 'Test Address',
    },
  });

  return prisma.user.create({
    data: {
      email: data?.email || 'test@example.com',
      password: data?.password || '$2a$10$YourHashedPasswordHere', // Hashed "password123"
      name: data?.name || 'Test User',
      role: data?.role || 'TEACHER',
      schoolId: school.id,
    },
  });
}

/**
 * Create test school with levels
 */
export async function createTestSchool() {
  const school = await prisma.school.create({
    data: {
      name: 'Test School',
      address: 'Test Address',
      phone: '123456789',
      email: 'school@test.com',
      npsn: '12345678',
    },
  });

  const level = await prisma.level.create({
    data: {
      schoolId: school.id,
      name: 'SMA',
      code: 'SMA',
    },
  });

  return { school, level };
}

/**
 * Generate JWT token for testing
 */
export function generateTestToken(payload: {
  userId: string;
  email: string;
  role: string;
}): string {
  // Gunakan JWT library untuk generate token
  const secret = process.env.JWT_ACCESS_SECRET || 'test-secret-key';

  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

/**
 * Example test file structure:
 * 
 * ```typescript
 * import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
 * import { setupTestDatabase, teardownTestDatabase, cleanDatabase, createTestUser } from './setup';
 * 
 * beforeAll(async () => {
 *   await setupTestDatabase();
 * });
 * 
 * afterAll(async () => {
 *   await teardownTestDatabase();
 * });
 * 
 * beforeEach(async () => {
 *   await cleanDatabase();
 * });
 * 
 * describe('User API', () => {
 *   test('should create user', async () => {
 *     const user = await createTestUser();
 *     expect(user.email).toBe('test@example.com');
 *   });
 * });
 * ```
 */

// Note: Don't auto-setup database globally
// Each test file should explicitly call setupTestDatabase() in beforeAll
// This gives more control and prevents unexpected database operations
