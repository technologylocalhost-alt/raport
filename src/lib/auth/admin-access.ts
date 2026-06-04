import { NextRequest } from 'next/server';
import { requireRoles } from '@/lib/auth/access';

export async function requireAdminOnly(req: NextRequest) {
  return requireRoles(req, ['ADMIN']);
}

export async function requireAdminOrPrincipal(req: NextRequest) {
  return requireRoles(req, ['ADMIN', 'PRINCIPAL']);
}
