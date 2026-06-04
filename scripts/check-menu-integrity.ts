import path from 'path';
import { getMenuPermissionSeeds } from '../src/lib/menu-registry';
import { CATALOGUED_SYSTEM_ROUTES } from '../src/lib/system-routes';

const APP_DIR = path.resolve(__dirname, '..', 'src', 'app');

async function main() {
  const fs = await import('node:fs/promises');

  const pageFiles: string[] = [];

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name === 'page.tsx') {
        pageFiles.push(fullPath);
      }
    }
  }

  await walk(APP_DIR);

  const pageRoutes = new Set(
    pageFiles
      .map((file) => file.replace(APP_DIR, '').replace(/\\/g, '/').replace(/\/page\.tsx$/, '').replace(/\/page\.tsx$/, ''))
      .filter((route) => route.length > 0 && !route.includes('/['))
  );

  const menuSeeds = getMenuPermissionSeeds();
  const menuPaths = menuSeeds.map((item) => item.menuPath);
  const duplicateMenuPaths = menuPaths.filter((item, index) => menuPaths.indexOf(item) !== index);

  const missingPages = menuPaths.filter((menuPath) => !pageRoutes.has(menuPath));

  const sidebarOrSystemRoutes = new Set<string>([
    ...menuPaths,
    ...CATALOGUED_SYSTEM_ROUTES,
  ]);

  const uncataloguedPages = Array.from(pageRoutes).filter((route) => {
    if (route.startsWith('/(auth)')) return false;
    if (route.endsWith('/menu/[slug]')) return false;
    if (route.endsWith('/akses/[...target]')) return false;
    return !sidebarOrSystemRoutes.has(route);
  });

  const report = {
    totalMenuSeeds: menuSeeds.length,
    duplicateMenuPaths,
    missingPages,
    uncataloguedPages,
  };

  console.log('=== MENU INTEGRITY REPORT ===');
  console.log(JSON.stringify(report, null, 2));

  if (duplicateMenuPaths.length || missingPages.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
