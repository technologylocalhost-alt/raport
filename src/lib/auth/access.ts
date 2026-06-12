import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { extractAccessToken } from '@/lib/auth/token-extractor';
import { UserRole } from '@prisma/client';

export type AuthenticatedUser = Awaited<ReturnType<typeof getAuthenticatedUser>>;

function getRaportMentalCandidatePaths(menuPath: string, role: UserRole): string[] {
  const paths = new Set<string>([menuPath]);

  const rolePrefix =
    role === UserRole.TEACHER
      ? '/teacher'
      : role === UserRole.WALI_KELAS
      ? '/wali-kelas'
      : role === UserRole.ADMIN || role === UserRole.PRINCIPAL
      ? '/admin'
      : null;

  if (!rolePrefix || !menuPath.startsWith('/admin')) {
    return Array.from(paths);
  }

  const suffix = menuPath.slice('/admin'.length);
  paths.add(`${rolePrefix}${suffix}`);

  if (suffix.startsWith('/raport-mental')) {
    const alternateSuffix =
      suffix === '/raport-mental'
        ? '/raport-mental/penilaian'
        : suffix === '/raport-mental/penilaian'
          ? '/raport-mental'
          : null;

    if (alternateSuffix) {
      paths.add(`${rolePrefix}${alternateSuffix}`);
    }
  }

  return Array.from(paths);
}

function hasMenuPermission(user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>, permission: { roles: string; bagian: string | null; isActive: boolean }) {
  if (!permission.isActive) return false;

  const bypassBagianCheck =
    user.role === UserRole.ADMIN ||
    user.role === UserRole.PRINCIPAL;

  if (permission.roles !== 'ALL') {
    const allowedRoles = permission.roles
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return false;
    }
  }

  if (permission.bagian && !bypassBagianCheck) {
    const requiredBagian = permission.bagian
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (requiredBagian.length > 0) {
      const hasMatch = requiredBagian.some((bagian) => user.bagian.includes(bagian));
      if (!hasMatch) return false;
    }
  }

  return true;
}

/**
 * Get authenticated user from access token cookie or Bearer token, including bagian list.
 * Returns null if token is invalid, user does not exist, or user is inactive.
 */
export async function getAuthenticatedUser(req: NextRequest) {
  const token = extractAccessToken(req);
  if (!token) return null;

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
 * - MenuPermission.isActive must be respected
 * - if MenuPermission.roles is configured (not ALL), user role must match
 * - if MenuPermission.bagian is configured, user must match one of them
 */
export async function requireRaportMentalAccess(
  req: NextRequest,
  menuPath: string = '/admin/raport-mental'
) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;

  const candidatePaths = getRaportMentalCandidatePaths(menuPath, user.role);

  const permissions = await prisma.menuPermission.findMany({
    where: { menuPath: { in: candidatePaths } },
  });

  let foundPermission = false;
  for (const path of candidatePaths) {
    const permission = permissions.find((item) => item.menuPath === path);
    if (!permission) continue;
    foundPermission = true;

    if (hasMenuPermission(user, permission)) {
      return user;
    }
  }

  if (foundPermission) return null;

  return user;
}
