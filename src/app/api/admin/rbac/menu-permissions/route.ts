import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { getMenuPermissionSeeds } from '@/lib/menu-registry';
import { requireMenuAccess } from '@/lib/auth/verify-access';
import { Bagian, UserRole } from '@prisma/client';
import { z } from 'zod';
import { serverError } from '@/lib/server-log';

async function requireMenuPermissionManagement(req: NextRequest) {
  return requireMenuAccess(req, '/admin/settings/rbac', ['ADMIN']);
}

const VALID_ROLES = Object.values(UserRole);
const VALID_BAGIAN = Object.values(Bagian);

function normalizeCsvEnumValue(
  value: string | null | undefined,
  validValues: readonly string[],
  fieldName: string,
  options?: { allowAll?: boolean; nullable?: boolean }
) {
  const trimmed = value?.trim() ?? '';

  if (!trimmed) {
    if (options?.nullable) return null;
    throw new Error(`${fieldName} wajib diisi`);
  }

  if (options?.allowAll && trimmed === 'ALL') {
    return 'ALL';
  }

  const parts = trimmed
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    if (options?.nullable) return null;
    throw new Error(`${fieldName} wajib diisi`);
  }

  const invalid = parts.filter((item) => !validValues.includes(item));
  if (invalid.length > 0) {
    throw new Error(`${fieldName} tidak valid: ${invalid.join(', ')}`);
  }

  const uniqueSorted = [...new Set(parts)].sort((a, b) => a.localeCompare(b));

  if (options?.allowAll && uniqueSorted.length === validValues.length) {
    return 'ALL';
  }

  return uniqueSorted.join(',');
}

/**
 * GET /api/admin/rbac/menu-permissions
 * List all menu permissions
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireMenuPermissionManagement(request);
    if (!admin) return errorResponse('Unauthorized', 401);

    const menuGroup = request.nextUrl.searchParams.get('menuGroup') || undefined;
    const where = menuGroup ? { menuGroup } : {};

    const permissions = await prisma.menuPermission.findMany({
      where,
      orderBy: [{ menuGroup: 'asc' }, { menuTitle: 'asc' }],
    });

    return successResponse(permissions);
  } catch (error) {
    serverError('Get menu permissions error:', error);
    return errorResponse('Failed to fetch menu permissions', 500);
  }
}

const permissionSchema = z.object({
  id: z.string().min(1),
  roles: z.string().min(1),
  bagian: z.string().nullable(),
  isActive: z.boolean(),
});

const bulkUpdateSchema = z.object({
  permissions: z.array(permissionSchema),
});

/**
 * PUT /api/admin/rbac/menu-permissions
 * Bulk update menu permissions
 */
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireMenuPermissionManagement(request);
    if (!admin) return errorResponse('Unauthorized', 401);

    const body = await request.json();
    const { permissions } = bulkUpdateSchema.parse(body);

    const normalizedPermissions = permissions.map((permission) => ({
      ...permission,
      roles: normalizeCsvEnumValue(permission.roles, VALID_ROLES, 'roles', { allowAll: true }) as string,
      bagian: normalizeCsvEnumValue(permission.bagian, VALID_BAGIAN, 'bagian', { nullable: true }) as string | null,
    }));

    await prisma.$transaction(
      normalizedPermissions.map((p) =>
        prisma.menuPermission.update({
          where: { id: p.id },
          data: {
            roles: p.roles,
            bagian: p.bagian,
            isActive: p.isActive,
          },
        })
      )
    );

    const updated = await prisma.menuPermission.findMany({
      orderBy: [{ menuGroup: 'asc' }, { menuTitle: 'asc' }],
    });

    return successResponse(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.issues);
    }
    if (error instanceof Error) {
      return errorResponse(error.message, 400);
    }
    serverError('Update menu permissions error:', error);
    return errorResponse('Failed to update menu permissions', 500);
  }
}

/**
 * POST /api/admin/rbac/menu-permissions
 * Sync menu permission rows from menu-registry.
 * Existing roles/bagian/isActive are preserved; menu title/group are refreshed.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireMenuPermissionManagement(request);
    if (!admin) return errorResponse('Unauthorized', 401);

    const seeds = getMenuPermissionSeeds();
    const existing = await prisma.menuPermission.findMany({
      select: { id: true, menuPath: true },
    });

    const existingPathSet = new Set(existing.map((item) => item.menuPath));
    const seedPathSet = new Set(seeds.map((item) => item.menuPath));

    await prisma.$transaction(
      seeds.map((seed) =>
        prisma.menuPermission.upsert({
          where: { menuPath: seed.menuPath },
          create: {
            menuPath: seed.menuPath,
            menuTitle: seed.menuTitle,
            menuGroup: seed.menuGroup,
          },
          update: {
            menuTitle: seed.menuTitle,
            menuGroup: seed.menuGroup,
          },
        })
      )
    );

    const stalePermissions = existing
      .filter((item) => !seedPathSet.has(item.menuPath))
      .map((item) => item.menuPath)
      .sort((a, b) => a.localeCompare(b));

    const synced = await prisma.menuPermission.findMany({
      orderBy: [{ menuGroup: 'asc' }, { menuTitle: 'asc' }],
    });

    const createdCount = seeds.filter((seed) => !existingPathSet.has(seed.menuPath)).length;
    const updatedCount = seeds.length - createdCount;

    return successResponse({
      permissions: synced,
      summary: {
        totalRegistryMenus: seeds.length,
        createdCount,
        updatedCount,
        staleCount: stalePermissions.length,
        stalePermissions,
      },
    });
  } catch (error) {
    serverError('Sync menu permissions error:', error);
    return errorResponse('Failed to sync menu permissions', 500);
  }
}
