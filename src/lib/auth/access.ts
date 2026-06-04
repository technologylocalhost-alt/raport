import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { UserRole } from '@prisma/client';

export type AuthenticatedUser = Awaited<ReturnType<typeof getAuthenticatedUser>>;

/**
 * Get authenticated user from Bearer token, including bagian list.
 * Returns null if token is invalid, user does not exist, or user is inactive.
 */
export async function getAuthenticatedUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      bagianList: {
        select: { bagian: true },
      },
    },
  });

  if (!user || !user.isActive) return null;

  const bagian = user.bagianList.map((item) => String(item.bagian));

  return {
    ...user,
    bagian,
  };
}

/**
 * Require one of the provided roles.
 */
export async function requireRoles(req: NextRequest, roles: UserRole[]) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;
  return roles.includes(user.role) ? user : null;
}

/**
 * Require that the authenticated user has at least one bagian.
 * If allowedBagian is provided, user must match at least one of them.
 */
export async function requireBagian(req: NextRequest, allowedBagian?: string[]) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;
  if (user.bagian.length === 0) return null;

  if (!allowedBagian || allowedBagian.length === 0) {
    return user;
  }

  const hasMatch = allowedBagian.some((bagian) => user.bagian.includes(bagian));
  return hasMatch ? user : null;
}

/**
 * Special access rule for Raport Mental.
 * - user must have at least one bagian
 * - MenuPermission.isActive must be respected
 * - if MenuPermission.roles is configured (not ALL), user role must match
 * - if MenuPermission.bagian is configured, user must match one of them
 */
export async function requireRaportMentalAccess(
  req: NextRequest,
  menuPath: string = '/admin/raport-mental'
) {
  const user = await requireBagian(req);
  if (!user) return null;

  const permission = await prisma.menuPermission.findUnique({
    where: { menuPath },
  });

  if (!permission) return user;
  if (!permission.isActive) return null;

  if (permission.roles !== 'ALL') {
    const allowedRoles = permission.roles
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return null;
    }
  }

  if (permission.bagian) {
    const requiredBagian = permission.bagian
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (requiredBagian.length > 0) {
      const hasMatch = requiredBagian.some((bagian) => user.bagian.includes(bagian));
      if (!hasMatch) return null;
    }
  }

  return user;
}
