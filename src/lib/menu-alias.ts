import { allMenuSections } from '@/lib/menu-registry';

export function getRoleBasePath(role?: string | null) {
  if (role === 'ADMIN' || role === 'PRINCIPAL') return '/admin';
  if (role === 'TEACHER') return '/teacher';
  if (role === 'WALI_KELAS') return '/wali-kelas';
  return '/admin';
}

function slugifyPath(targetPath: string) {
  const segments = targetPath.split('/').filter(Boolean);
  const [, ...rest] = segments;
  return rest.join('-');
}

function getAllMenuPaths() {
  return allMenuSections.flatMap((section) =>
    section.items?.map((item) => item.href) || (section.href ? [section.href] : [])
  );
}

function buildAliasMaps() {
  const pathToSlug = new Map<string, string>();
  const slugCounts = new Map<string, number>();

  for (const path of getAllMenuPaths()) {
    const baseSlug = slugifyPath(path);
    slugCounts.set(baseSlug, (slugCounts.get(baseSlug) || 0) + 1);
  }

  for (const path of getAllMenuPaths()) {
    const baseSlug = slugifyPath(path);
    const group = path.split('/').filter(Boolean)[0] || 'menu';
    const finalSlug = (slugCounts.get(baseSlug) || 0) > 1 ? `${group}-${baseSlug}` : baseSlug;
    pathToSlug.set(path, finalSlug);
  }

  const slugToPath = new Map<string, string>();
  for (const [path, slug] of pathToSlug.entries()) {
    slugToPath.set(slug, path);
  }

  return { pathToSlug, slugToPath };
}

const { pathToSlug, slugToPath } = buildAliasMaps();

export function toRoleScopedPath(targetPath: string, role?: string | null) {
  const roleBasePath = getRoleBasePath(role);
  if (targetPath.startsWith(roleBasePath)) return targetPath;

  const slug = pathToSlug.get(targetPath) || slugifyPath(targetPath);
  return `${roleBasePath}/menu/${slug}`;
}

export function toCanonicalPath(pathname: string, role?: string | null) {
  const roleBasePath = getRoleBasePath(role);
  const aliasPrefix = `${roleBasePath}/menu/`;

  if (pathname.startsWith(aliasPrefix)) {
    const slug = pathname.slice(aliasPrefix.length);
    return slugToPath.get(slug) || pathname;
  }

  return pathname;
}

export function getCanonicalPathFromAliasSlug(slug: string) {
  return slugToPath.get(slug) || null;
}
