import { prisma } from '@/lib/db';

/**
 * Check if a user can access a specific menu path based on MenuPermission records.
 * Default: if no MenuPermission record exists for the path, access is allowed (backward compatible).
 */
export async function canAccessMenu(
  menuPath: string,
  userRole: string,
  userBagian: string[]
): Promise<boolean> {
  const permission = await prisma.menuPermission.findUnique({
    where: { menuPath },
  });

  // No record = no restriction (backward compatible)
  if (!permission) return true;

  // Inactive permission = hidden from everyone
  if (!permission.isActive) return false;

  // Check role
  if (permission.roles !== 'ALL') {
    const allowedRoles = permission.roles.split(',').map((r) => r.trim());
    if (!allowedRoles.includes(userRole)) return false;
  }

  // Check bagian (if restriction is set)
  if (permission.bagian) {
    const requiredBagian = permission.bagian.split(',').map((b) => b.trim());
    // User must have at least one matching bagian
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

  // If no permissions exist at all, return empty array to signal "no restrictions"
  if (permissions.length === 0) return [];

  const allowed: string[] = [];

  for (const perm of permissions) {
    if (!perm.isActive) continue;

    // Check role
    if (perm.roles !== 'ALL') {
      const allowedRoles = perm.roles.split(',').map((r) => r.trim());
      if (!allowedRoles.includes(userRole)) continue;
    }

    // Check bagian
    if (perm.bagian) {
      const requiredBagian = perm.bagian.split(',').map((b) => b.trim());
      const hasMatch = requiredBagian.some((b) => userBagian.includes(b));
      if (!hasMatch) continue;
    }

    allowed.push(perm.menuPath);
  }

  return allowed;
}
