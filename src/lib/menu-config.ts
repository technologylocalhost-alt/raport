import { getRoleBasePath, toCanonicalPath, toRoleScopedPath } from '@/lib/menu-alias';
import { allMenuSections, getFlatMenuItems, type MenuItemConfig, type MenuSectionConfig } from '@/lib/menu-registry';
import { isAlwaysAllowedRoute } from '@/lib/system-routes';

export { allMenuSections } from '@/lib/menu-registry';

export function isPathAllowed(
  pathname: string,
  allowedPaths: string[] | null,
  currentRole?: string | null
) {
  if (isAlwaysAllowedRoute(pathname, currentRole)) return true;
  if (allowedPaths === null) return true;

  const canonicalPath = toCanonicalPath(pathname, currentRole);

  return allowedPaths.some((allowedPath) =>
    canonicalPath === allowedPath || canonicalPath.startsWith(`${allowedPath}/`)
  );
}

function sectionBelongsToPrefix(section: MenuSectionConfig, prefix: string) {
  if (section.href) return section.href.startsWith(prefix);
  return (section.items || []).some((item) => item.href.startsWith(prefix));
}

export function getMenuSourceLabel(href: string) {
  if (href.startsWith('/admin')) return 'Admin';
  if (href.startsWith('/teacher')) return 'Guru';
  if (href.startsWith('/wali-kelas')) return 'Wali Kelas';
  return 'Menu';
}

export function getMenuDisplayParts(title: string) {
  const parts = title.split(' · ');
  if (parts.length < 2) {
    return { label: title, badge: null as string | null };
  }

  return {
    label: parts.slice(0, -1).join(' · '),
    badge: parts[parts.length - 1] || null,
  };
}

export function filterMenuSectionsByAllowedPaths(
  allowedPaths: string[] | null,
  currentRole?: string | null
) {
  const filtered = (allowedPaths === null ? allMenuSections : allMenuSections
    .map((section) => {
      if (section.items) {
        return {
          ...section,
          items: section.items.filter((item) => allowedPaths.includes(item.href)),
        };
      }

      if (section.href && !allowedPaths.includes(section.href)) {
        return null;
      }

      return section;
    })
    .filter((section): section is MenuSectionConfig => Boolean(section && (!section.items || section.items.length > 0))));

  const ownPrefix = getRoleBasePath(currentRole);
  if (!ownPrefix) return filtered;

  const ownSections = filtered.filter((section) => sectionBelongsToPrefix(section, ownPrefix));
  const extraSections = filtered.filter((section) => !sectionBelongsToPrefix(section, ownPrefix));

  return [
    ...ownSections,
    ...(extraSections.length > 0
      ? [{
          title: 'Akses Tambahan',
          items: extraSections
            .flatMap<MenuItemConfig>((section) => {
              if (section.items) {
                return section.items.map((item) => ({
                  ...item,
                  title: `${item.title} · ${getMenuSourceLabel(item.href)}`,
                }));
              }
              if (section.href && section.icon) {
                return [{
                  title: `${section.title} · ${getMenuSourceLabel(section.href)}`,
                  href: section.href,
                  icon: section.icon,
                }];
              }
              return [];
            })
            .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.title.localeCompare(b.title, 'id')),
        } satisfies MenuSectionConfig]
      : []),
  ];
}

export function findMenuTitleByPath(pathname: string, currentRole?: string | null) {
  const canonicalPath = toCanonicalPath(pathname, currentRole);
  const allItems = getFlatMenuItems();

  const exactMatch = allItems.find((item) => item.href === canonicalPath);
  if (exactMatch) return exactMatch.title;

  const prefixMatch = allItems.find((item) => canonicalPath.startsWith(`${item.href}/`));
  return prefixMatch?.title || 'Dashboard';
}

export function resolveMenuHref(href: string, currentRole?: string | null) {
  return toRoleScopedPath(href, currentRole);
}
