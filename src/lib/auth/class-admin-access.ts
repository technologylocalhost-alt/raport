import { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/access';
import { requireMenuAccess } from '@/lib/auth/verify-access';

export async function requireClassReadUser(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;

  if (user.role === 'ADMIN' || user.role === 'PRINCIPAL') {
    return requireMenuAccess(req, '/admin/classes', ['ADMIN', 'PRINCIPAL']);
  }

  if (user.role === 'WALI_KELAS') {
    return requireMenuAccess(req, '/wali-kelas/classes', ['WALI_KELAS']);
  }

  if (user.role === 'TEACHER') {
    return requireMenuAccess(req, '/teacher/subjects', ['TEACHER']);
  }

  return null;
}

export async function requireClassAdmin(req: NextRequest) {
  return requireMenuAccess(req, '/admin/classes', ['ADMIN', 'PRINCIPAL']);
}
