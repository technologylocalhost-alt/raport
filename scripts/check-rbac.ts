import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(__dirname, '..', '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  // Check ALL permissions
  const perms = await prisma.menuPermission.findMany({
    orderBy: [{ menuGroup: 'asc' }, { menuPath: 'asc' }],
  });

  console.log('=== ALL MENU PERMISSIONS ===');
  for (const p of perms) {
    const isModified = p.roles !== 'ALL' || p.bagian !== null || !p.isActive;
    const tag = isModified ? ' *** MODIFIED ***' : '';
    console.log(
      p.menuGroup.padEnd(12),
      p.menuPath.padEnd(42),
      'roles:', p.roles.padEnd(30),
      'bagian:', String(p.bagian).padEnd(20),
      'active:', p.isActive,
      tag
    );
  }

  // Simulate what the API returns for walikelas2
  const user = await prisma.user.findUnique({
    where: { email: 'walikelas2@sekolah.id' },
    include: { bagianList: true },
  });

  if (!user) {
    console.log('\nUser not found!');
    return;
  }

  const userBagian = user.bagianList.map(b => b.bagian);
  console.log('\n=== USER: walikelas2@sekolah.id ===');
  console.log('Role:', user.role);
  console.log('Bagian:', userBagian);

  // Simulate getAllowedMenuPaths for wali-kelas group
  const wkPerms = perms.filter(p => p.menuGroup === 'wali-kelas');
  const allowed: string[] = [];

  for (const perm of wkPerms) {
    if (!perm.isActive) {
      console.log(`  SKIP ${perm.menuPath} -> inactive`);
      continue;
    }

    if (perm.roles !== 'ALL') {
      const allowedRoles = perm.roles.split(',').map(r => r.trim());
      if (!allowedRoles.includes(user.role)) {
        console.log(`  SKIP ${perm.menuPath} -> role ${user.role} not in [${allowedRoles}]`);
        continue;
      }
    }

    if (perm.bagian) {
      const requiredBagian = perm.bagian.split(',').map(b => b.trim());
      const hasMatch = requiredBagian.some(b => userBagian.includes(b));
      if (!hasMatch) {
        console.log(`  SKIP ${perm.menuPath} -> bagian ${userBagian} has no match with required [${requiredBagian}]`);
        continue;
      }
    }

    console.log(`  ALLOW ${perm.menuPath}`);
    allowed.push(perm.menuPath);
  }

  console.log('\n=== RESULT ===');
  console.log('allowedPaths:', allowed);
  console.log('hasRestrictions:', allowed.length > 0);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
