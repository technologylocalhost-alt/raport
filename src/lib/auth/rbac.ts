import { prisma } from '@/lib/db';
import { UserRole } from '@prisma/client';

/**
 * Check if a user can access a specific menu path based on MenuPermission records.
 * Default: fail closed if no MenuPermission record exists for the path.
 */
export async function canAccessMenu(
  menuPath: string,
  userRole: string,
  userBagian: string[]
): Promise<boolean> {
  const permission = await prisma.menuPermission.findUnique({
    where: { menuPath },
  });

  // Missing permission row = deny until the route is explicitly catalogued.
  if (!permission) return false;

  // Inactive permission = hidden from everyone.
  if (!permission.isActive) return false;

  // Check role.
  if (permission.roles !== 'ALL') {
    const allowedRoles = permission.roles.split(',').map((r) => r.trim());
    if (!allowedRoles.includes(userRole)) return false;
  }

  const bypassBagianCheck =
    userRole === UserRole.ADMIN ||
    userRole === UserRole.PRINCIPAL;

  // Check bagian (if restriction is set).
  if (permission.bagian && !bypassBagianCheck) {
    const requiredBagian = permission.bagian.split(',').map((b) => b.trim());
    const hasMatch = requiredBagian.some((b) => userBagian.includes(b));
    if (!hasMatch) return false;
  }

  return true;
}

/**
 * Get all menu permissions, optionally filtered by menuGroup.
 */
export async function getMenuPermissions(menuGroup?: string) {
  const where = menuGroup ? { menuGroup } : {};
  return prisma.menuPermission.findMany({
    where,
    orderBy: [{ menuGroup: 'asc' }, { menuTitle: 'asc' }],
  });
}

/**
 * Get all allowed menu paths for a given user role and bagian.
 * Returns array of menu paths the user is allowed to access.
 */
export async function getAllowedMenuPaths(
  userRole: string,
  userBagian: string[],
  menuGroup?: string
): Promise<string[]> {
  const permissions = await getMenuPermissions(menuGroup);

  // Missing registry rows should never broaden access.
  if (permissions.length === 0) return [];

  const allowed: string[] = [];

  for (const perm of permissions) {
    if (!perm.isActive) continue;

    const bypassBagianCheck =
      userRole === UserRole.ADMIN ||
      userRole === UserRole.PRINCIPAL;

    // Check role.
    if (perm.roles !== 'ALL') {
      const allowedRoles = perm.roles.split(',').map((r) => r.trim());
      if (!allowedRoles.includes(userRole)) continue;
    }

    // Check bagian.
    if (perm.bagian && !bypassBagianCheck) {
      const requiredBagian = perm.bagian.split(',').map((b) => b.trim());
      const hasMatch = requiredBagian.some((b) => userBagian.includes(b));
      if (!hasMatch) continue;
    }

    allowed.push(perm.menuPath);
  }

  return allowed;
}
