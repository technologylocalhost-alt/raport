'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4">
      <div className="max-w-lg w-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 sm:p-10 text-center shadow-2xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
          <ShieldAlert size={34} />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white">Akses Ditolak</h1>
        <p className="mt-3 text-sm sm:text-base text-slate-300 leading-6">
          Akun Anda valid, tetapi belum memiliki izin menu untuk halaman yang diminta.
          Hubungi administrator untuk menyesuaikan role atau bagian Anda.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors"
          >
            Kembali ke Beranda
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-transparent px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
          >
            Login Ulang
          </Link>
        </div>
      </div>
    </div>
  );
}
