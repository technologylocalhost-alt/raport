import { apiFetch } from '@/lib/api-client';

export async function fetchAllowedMenuPaths(menuGroup: 'admin' | 'teacher' | 'wali-kelas') {
  const res = await apiFetch(`/api/admin/rbac/user-menu?menuGroup=${menuGroup}`);

  if (!res.ok) {
    return {
      allowedPaths: [] as string[],
      hasRestrictions: true,
    };
  }

  const data = await res.json();

  return {
    allowedPaths: (data.data?.allowedPaths || []) as string[],
    hasRestrictions: Boolean(data.data?.hasRestrictions),
  };
}
