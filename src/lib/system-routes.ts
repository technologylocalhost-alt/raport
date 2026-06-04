import { toCanonicalPath } from '@/lib/menu-alias';

export type SystemRouteCategory = 'profile' | 'detail' | 'preview' | 'report' | 'utility';
export type SystemRouteAccess = 'always' | 'catalogued';

export interface SystemRouteMeta {
  path: string;
  category: SystemRouteCategory;
  access: SystemRouteAccess;
}

export const SYSTEM_ROUTE_META: readonly SystemRouteMeta[] = [
  { path: '/admin/profile', category: 'profile', access: 'always' },
  { path: '/teacher/profile', category: 'profile', access: 'always' },
  { path: '/wali-kelas/profile', category: 'profile', access: 'always' },
  { path: '/admin/profiles', category: 'profile', access: 'always' },
  { path: '/teacher/profiles', category: 'profile', access: 'always' },
  { path: '/wali-kelas/profiles', category: 'profile', access: 'always' },

  { path: '/admin/raport-arab/cover-preview', category: 'preview', access: 'catalogued' },
  { path: '/admin/raport-arab/detail', category: 'detail', access: 'catalogued' },
  { path: '/admin/raport-mental/laporan', category: 'report', access: 'catalogued' },
  { path: '/admin/reports/detail', category: 'detail', access: 'catalogued' },
  { path: '/admin/santri/tambah', category: 'utility', access: 'catalogued' },
  { path: '/admin/school-years', category: 'utility', access: 'catalogued' },
  { path: '/admin/semesters', category: 'utility', access: 'catalogued' },

  { path: '/teacher/competencies', category: 'utility', access: 'catalogued' },
  { path: '/teacher/raport-mental/laporan', category: 'report', access: 'catalogued' },
  { path: '/teacher/reports', category: 'report', access: 'catalogued' },

  { path: '/wali-kelas/competencies', category: 'utility', access: 'catalogued' },
  { path: '/wali-kelas/raport-arab/bulk-download', category: 'utility', access: 'catalogued' },
  { path: '/wali-kelas/raport-arab/bulk-review', category: 'preview', access: 'catalogued' },
  { path: '/wali-kelas/raport-arab/cover-preview', category: 'preview', access: 'catalogued' },
  { path: '/wali-kelas/raport-arab/detail', category: 'detail', access: 'catalogued' },
  { path: '/wali-kelas/raport-mental/laporan', category: 'report', access: 'catalogued' },
  { path: '/wali-kelas/reports/detail', category: 'detail', access: 'catalogued' },
  { path: '/wali-kelas/students', category: 'utility', access: 'catalogued' },
  { path: '/wali-kelas/teachers', category: 'utility', access: 'catalogued' },
] as const;

export const ALWAYS_ALLOWED_ROUTES = SYSTEM_ROUTE_META
  .filter((route) => route.access === 'always')
  .map((route) => route.path) as readonly string[];

export const CATALOGUED_NON_MENU_ROUTES = SYSTEM_ROUTE_META
  .filter((route) => route.access === 'catalogued')
  .map((route) => route.path) as readonly string[];

export const CATALOGUED_SYSTEM_ROUTES = SYSTEM_ROUTE_META.map((route) => route.path) as readonly string[];

export function getSystemRouteMeta(pathname: string, currentRole?: string | null) {
  const canonicalPath = toCanonicalPath(pathname, currentRole);
  return SYSTEM_ROUTE_META.find((route) => route.path === canonicalPath) || null;
}

export function isAlwaysAllowedRoute(pathname: string, currentRole?: string | null) {
  const meta = getSystemRouteMeta(pathname, currentRole);
  return meta?.access === 'always';
}

export function isCataloguedSystemRoute(pathname: string, currentRole?: string | null) {
  return !!getSystemRouteMeta(pathname, currentRole);
}
