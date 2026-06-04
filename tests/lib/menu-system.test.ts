import { describe, test, expect } from 'bun:test';
import {
  getFlatMenuItems,
  getMenuPermissionSeeds,
} from '@/lib/menu-registry';
import {
  filterMenuSectionsByAllowedPaths,
  isPathAllowed,
  resolveMenuHref,
} from '@/lib/menu-config';
import {
  getCanonicalPathFromAliasSlug,
  toCanonicalPath,
} from '@/lib/menu-alias';
import {
  ALWAYS_ALLOWED_ROUTES,
  CATALOGUED_NON_MENU_ROUTES,
  getSystemRouteMeta,
  isAlwaysAllowedRoute,
} from '@/lib/system-routes';

describe('menu system', () => {
  test('should generate flat menu items with source role and order', () => {
    const items = getFlatMenuItems();

    expect(items.length > 0).toBeTruthy();
    expect(items.every((item) => !!item.sourceRole)).toBeTruthy();
    expect(items.every((item) => typeof item.order === 'number')).toBeTruthy();
  });

  test('should generate permission seeds from registry without duplicates', () => {
    const seeds = getMenuPermissionSeeds();
    const paths = seeds.map((seed) => seed.menuPath);
    const uniquePaths = new Set(paths);

    expect(seeds.length).toBe(uniquePaths.size);
    expect(seeds.length > 0).toBeTruthy();
  });

  test('should resolve cross-role menu href into role-scoped alias', () => {
    const href = resolveMenuHref('/wali-kelas/reports', 'TEACHER');

    expect(href).toBe('/teacher/menu/reports');
  });

  test('should convert aliased path back to canonical path', () => {
    const canonical = toCanonicalPath('/teacher/menu/reports', 'TEACHER');

    expect(canonical).toBe('/wali-kelas/reports');
  });

  test('should resolve slug back to canonical path', () => {
    const canonical = getCanonicalPathFromAliasSlug('reports');

    expect(canonical).toBe('/wali-kelas/reports');
  });

  test('should allow always-allowed profile route even when menu list is restricted', () => {
    const allowed = isPathAllowed('/teacher/profile', ['/teacher/dashboard'], 'TEACHER');

    expect(allowed).toBeTruthy();
    expect(isAlwaysAllowedRoute('/teacher/profiles', 'TEACHER')).toBeTruthy();
  });

  test('should keep own-role sections first and move cross-role items to extra access', () => {
    const sections = filterMenuSectionsByAllowedPaths(
      ['/teacher/dashboard', '/wali-kelas/reports'],
      'TEACHER'
    );

    expect(sections[0]?.title).toBe('Dashboard');
    expect(sections[1]?.title).toBe('Akses Tambahan');
    expect(sections[1]?.items?.[0]?.title).toContain('Wali Kelas');
  });

  test('should expose system route metadata', () => {
    expect(ALWAYS_ALLOWED_ROUTES.includes('/teacher/profile')).toBeTruthy();
    expect(CATALOGUED_NON_MENU_ROUTES.includes('/teacher/reports')).toBeTruthy();

    const meta = getSystemRouteMeta('/teacher/reports');
    expect(meta?.category).toBe('report');
    expect(meta?.access).toBe('catalogued');
  });
});
