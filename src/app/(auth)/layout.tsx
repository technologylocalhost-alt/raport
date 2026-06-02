import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Login - Raport',
  description: 'Sistem Manajemen Raport Sekolah',
};

export const dynamic = 'force-dynamic'; // Force dynamic rendering
export const revalidate = 0; // No caching

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
