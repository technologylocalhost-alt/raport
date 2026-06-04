/**
 * Seed script for MenuPermission table.
 * Populates all menu paths from admin, teacher, and wali-kelas layouts.
 *
 * Run: npx tsx scripts/seed-menu-permissions.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';
import path from 'path';
import { getMenuPermissionSeeds } from '../src/lib/menu-registry';

config({ path: path.resolve(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const menuPermissions = getMenuPermissionSeeds();

async function main() {
  console.log('Seeding MenuPermission...');

  for (const perm of menuPermissions) {
    await prisma.menuPermission.upsert({
      where: { menuPath: perm.menuPath },
      update: {
        menuTitle: perm.menuTitle,
        menuGroup: perm.menuGroup,
      },
      create: {
        menuPath: perm.menuPath,
        menuTitle: perm.menuTitle,
        menuGroup: perm.menuGroup,
        roles: 'ALL',
        bagian: null,
        isActive: true,
      },
    });
    console.log(`  + ${perm.menuGroup} -> ${perm.menuPath}`);
  }

  const count = await prisma.menuPermission.count();
  console.log(`\nDone! Total MenuPermission records: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
