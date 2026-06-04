import { NextRequest } from 'next/server';
import { UserRole } from '@prisma/client';
import { canAccessMenu } from './rbac';
import { getAuthenticatedUser } from '@/lib/auth/access';

/**
 * Verify that the authenticated user has access to a specific menu path.
 * Returns the token payload if access is granted, null otherwise.
 *
 * Usage in API routes:
 *   const payload = await verifyMenuAccess(request, '/admin/raport-mental/penilaian');
 *   if (!payload) return errorResponse('Forbidden', 403);
 */
export async function verifyMenuAccess(
  req: NextRequest,
  menuPath: string
) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;

  const hasAccess = await canAccessMenu(menuPath, user.role, user.bagian);
  if (!hasAccess) return null;

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    schoolId: user.schoolId,
    bagian: user.bagian,
  };
}

/**
 * Require authenticated user that matches explicit roles AND menu permission.
 * Use this in API routes so server-side access follows RBAC menu config.
 */
export async function requireMenuAccess(
  req: NextRequest,
  menuPath: string,
  allowedRoles?: UserRole[]
) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return null;
  }

  const hasAccess = await canAccessMenu(menuPath, user.role, user.bagian);
  return hasAccess ? user : null;
}
