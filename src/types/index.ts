/**
 * Shared TypeScript Types
 * Central location untuk semua type definitions
 */

import { UserRole, CompetencyType, ScoringType, AssessmentType, AttendanceStatus } from '@prisma/client';

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: any;
  statusCode: number;
}

// ============================================================================
// Authentication Types
// ============================================================================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  schoolId: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  schoolId?: string;
  exp?: number;
  iat?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  schoolId: string;
  isActive: boolean;
}

export interface AuthResponse {
  success: boolean;
  accessToken: string;
  user: AuthUser;
}

// ============================================================================
// User Types
// ============================================================================

export interface UserData {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  schoolId: string;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  schoolId: string;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
}

// ============================================================================
// School Types
// ============================================================================

export interface SchoolData {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  npsn?: string;
  principal?: string;
}

export interface CreateSchoolInput {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  npsn?: string;
}

// ============================================================================
// Student Types
// ============================================================================

export interface StudentData {
  id: string;
  classId: string;
  studentNo: string;
  name: string;
  email?: string;
  phone?: string;
  gender: string;
  birthDate?: Date | string;
  address?: string;
  parentPhoneNo?: string;
}

export interface CreateStudentInput {
  classId: string;
  studentNo: string;
  name: string;
  email?: string;
  phone?: string;
  gender?: string;
  birthDate?: string;
  address?: string;
  parentPhoneNo?: string;
}

export interface UpdateStudentInput {
  name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  birthDate?: string;
  address?: string;
  parentPhoneNo?: string;
}

// ============================================================================
// Grade Types
// ============================================================================

export interface GradeData {
  id: string;
  studentId: string;
  competencyId: string;
  levelId: string;
  teacherId: string;
  score: string;
  scoringType: ScoringType;
  assessmentType: AssessmentType;
  notes?: string;
  studentName?: string;
  competencyName?: string;
  subjectName?: string;
}

export interface CreateGradeInput {
  studentId: string;
  competencyId: string;
  levelId: string;
  score: string;
  scoringType: ScoringType;
  assessmentType: AssessmentType;
  notes?: string;
}

export interface UpdateGradeInput {
  score?: string;
  scoringType?: ScoringType;
  assessmentType?: AssessmentType;
  notes?: string;
}

// ============================================================================
// Attendance Types
// ============================================================================

export interface AttendanceData {
  id: string;
  studentId: string;
  date: Date | string;
  status: AttendanceStatus;
  notes?: string;
}

export interface CreateAttendanceInput {
  studentId: string;
  date: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface AttendanceSummary {
  HADIR: number;
  SAKIT: number;
  IZIN: number;
  ALFA: number;
}

// ============================================================================
// Report Types
// ============================================================================

export interface ReportData {
  student: StudentData;
  grades: GradeData[];
  attendance: AttendanceSummary;
  studentNotes: {
    developmentNotes: string;
    achievedCompetencies: string;
    improvementAreas: string;
  };
  semester: string;
  schoolYear: string;
  school: SchoolData;
}

export interface StudentNote {
  id: string;
  studentId: string;
  semesterId?: string;
  classId: string;
  developmentNotes?: string;
  achievedCompetencies?: string;
  improvementAreas?: string;
}

// ============================================================================
// Query Parameters Types
// ============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SearchParams extends PaginationParams {
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface StudentQueryParams extends SearchParams {
  classId?: string;
  gender?: string;
}

export interface GradeQueryParams extends SearchParams {
  studentId?: string;
  classId?: string;
  subjectId?: string;
  assessmentType?: AssessmentType;
}

// ============================================================================
// Utility Types
// ============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Export Prisma enums for convenience
export { UserRole, CompetencyType, ScoringType, AssessmentType, AttendanceStatus };
