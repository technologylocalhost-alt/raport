import { NextRequest } from 'next/server';
import { AuthenticatedUser, getAuthenticatedUser } from '@/lib/auth/access';
import { requireMenuAccess } from '@/lib/auth/verify-access';
import { prisma } from '@/lib/db';

export async function requireClassSubjectAccess(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;

  if (user.role === 'ADMIN' || user.role === 'PRINCIPAL') {
    return requireMenuAccess(req, '/admin/classes', ['ADMIN', 'PRINCIPAL']);
  }

  if (user.role === 'WALI_KELAS') {
    return requireMenuAccess(req, '/wali-kelas/management', ['WALI_KELAS']);
  }

  return null;
}

export async function ensureClassOwnedByWaliKelasOrAllowed(
  user: NonNullable<AuthenticatedUser>,
  classId: string
) {
  const classData = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, waliKelasId: true, name: true },
  });

  if (!classData) {
    return { ok: false as const, reason: 'NOT_FOUND' as const };
  }

  if (user.role === 'WALI_KELAS' && classData.waliKelasId !== user.id) {
    return { ok: false as const, reason: 'FORBIDDEN' as const };
  }

  return { ok: true as const, classData };
}
