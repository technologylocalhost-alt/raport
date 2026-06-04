import { NextRequest } from 'next/server';
import { requireRoles, getAuthenticatedUser } from '@/lib/auth/access';

export async function requireAuthenticated(req: NextRequest) {
  return getAuthenticatedUser(req);
}

export async function requireTeacherOnly(req: NextRequest) {
  return requireRoles(req, ['TEACHER']);
}

export async function requireWaliKelasOnly(req: NextRequest) {
  return requireRoles(req, ['WALI_KELAS']);
}

export async function requireTeacherOrWaliKelas(req: NextRequest) {
  return requireRoles(req, ['TEACHER', 'WALI_KELAS']);
}

export async function requireTeacherWaliAdminPrincipal(req: NextRequest) {
  return requireRoles(req, ['TEACHER', 'WALI_KELAS', 'ADMIN', 'PRINCIPAL']);
}

export async function requireWaliKelasAdminPrincipal(req: NextRequest) {
  return requireRoles(req, ['WALI_KELAS', 'ADMIN', 'PRINCIPAL']);
}

/**
 * Backward-compatible alias.
 * Prefer requireTeacherWaliAdminPrincipal for explicit role coverage.
 */
export async function requireTeacherWaliOrAdmin(req: NextRequest) {
  return requireTeacherWaliAdminPrincipal(req);
}

/**
 * Backward-compatible alias.
 * Prefer requireWaliKelasAdminPrincipal for explicit role coverage.
 */
export async function requireWaliKelasOrAdminPrincipal(req: NextRequest) {
  return requireWaliKelasAdminPrincipal(req);
}
