import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedUser } from '@/lib/auth/access';
import { getAllowedMenuPaths } from '@/lib/auth/rbac';
import { serverError } from '@/lib/server-log';

/**
 * GET /api/admin/rbac/user-menu
 * Get allowed menu paths for the current authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const bagianList = user.bagian;
    const menuGroup = request.nextUrl.searchParams.get('menuGroup') || undefined;

    // Enforce route-group boundary by role.
    const roleGroupMap: Record<string, string> = {
      ADMIN: 'admin',
      PRINCIPAL: 'admin',
      TEACHER: 'teacher',
      WALI_KELAS: 'wali-kelas',
    };
    const allowedGroup = roleGroupMap[user.role];
    if (menuGroup && allowedGroup && menuGroup !== allowedGroup) {
      return successResponse({
        role: user.role,
        bagian: bagianList,
        allowedPaths: [],
        hasRestrictions: true,
      });
    }

    const allowedPaths = await getAllowedMenuPaths(
      user.role,
      bagianList,
      menuGroup
    );

    return successResponse({
      role: user.role,
      bagian: bagianList,
      allowedPaths,
      // Treat menu permissions as authoritative. An empty result set is still restricted.
      hasRestrictions: true,
    });
  } catch (error) {
    serverError('Get user menu error:', error);
    return errorResponse('Failed to fetch user menu', 500);
  }
}
