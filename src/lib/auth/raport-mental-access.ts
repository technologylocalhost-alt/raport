import { NextRequest } from 'next/server';
import { requireRaportMentalAccess } from '@/lib/auth/access';

/**
 * Backward-compatible wrapper.
 * Prefer using requireRaportMentalAccess from src/lib/auth/access.ts
 */
export async function verifyRaportMentalAccess(
  req: NextRequest,
  menuPath: string = '/admin/raport-mental'
) {
  return requireRaportMentalAccess(req, menuPath);
}
