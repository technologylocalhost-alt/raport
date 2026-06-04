/**
 * Shared TypeScript Types
 * Central location untuk semua type definitions
 */

import { UserRole, CompetencyType, ScoringType, AssessmentType, AttendanceStatus, ActivityAction, ActivityStatus, Bagian } from '@prisma/client';

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = unknown> {
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
  details?: unknown;
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
  bagian?: string[];
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
  bagian?: string[];
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
  bagian?: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  schoolId: string;
  bagian?: string[];
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
  bagian?: string[];
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
  competencyId?: string | null;
  subjectId: string;
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
  competencyId?: string | null;
  subjectId: string;
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

// ============================================================================
// Activity Logging Types
// ============================================================================

export interface ActivityLogData {
  id: string;
  userId: string;
  action: ActivityAction;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  description?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  userAgent?: string;
  status: ActivityStatus;
  errorMessage?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ActivityLogResponse extends ActivityLogData {
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface LogActivityInput {
  userId: string;
  action: ActivityAction;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  description?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
  status?: ActivityStatus;
  errorMessage?: string;
}

export interface ActivityLogFilter {
  userId?: string;
  action?: ActivityAction;
  resourceType?: string;
  resourceId?: string;
  status?: ActivityStatus;
  startDate?: Date | string;
  endDate?: Date | string;
  page?: number;
  limit?: number;
}

// ============================================================================
// Menu Permission / RBAC Types
// ============================================================================

export interface MenuPermissionData {
  id: string;
  menuPath: string;
  menuTitle: string;
  menuGroup: string;
  roles: string;
  bagian: string | null;
  isActive: boolean;
}

// Export Prisma enums for convenience
export { UserRole, CompetencyType, ScoringType, AssessmentType, AttendanceStatus, ActivityAction, ActivityStatus, Bagian };
