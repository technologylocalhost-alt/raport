'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Users, BarChart3, BookOpen, Calendar, GraduationCap, ArrowRight, FileText } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
      return;
    }

    const userData = JSON.parse(storedUser);
    if (userData.role !== 'ADMIN' && userData.role !== 'PRINCIPAL') {
      router.push('/teacher/dashboard');
      return;
    }

    setUser(userData);
    setIsLoading(false);
  }, [router]);

  async function handleLogout() {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear storage and redirect, even if API call fails
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      router.push('/login');
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-4 sm:p-6 text-white">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">Selamat Datang, {user?.name}! 👋</h1>
        <p className="text-blue-100 text-sm sm:text-base">
          Kelola sistem raport sekolah Anda dengan mudah dan efisien
        </p>
      </div>

      {/* Master Data Section */}
      <div>
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Master Data</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Data Sekolah */}
          <Link
            href="/admin/schools"
            className="bg-white rounded-lg shadow hover:shadow-lg transition-all group border-l-4 border-blue-500 p-4 sm:p-6"
          >
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="p-2 sm:p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                <Building2 size={20} className="sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <ArrowRight size={18} className="text-gray-300 group-hover:text-blue-600 transition-colors flex-shrink-0" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Data Sekolah</h3>
            <p className="text-gray-600 text-xs sm:text-sm mt-1">Kelola informasi sekolah</p>
          </Link>

          {/* Tahun Ajaran */}
          <Link
            href="/admin/school-years"
            className="bg-white rounded-lg shadow hover:shadow-lg transition-all group border-l-4 border-green-500 p-4 sm:p-6"
          >
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="p-2 sm:p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                <Calendar size={20} className="sm:w-6 sm:h-6 text-green-600" />
              </div>
              <ArrowRight size={18} className="text-gray-300 group-hover:text-green-600 transition-colors flex-shrink-0" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Tahun Ajaran</h3>
            <p className="text-gray-600 text-xs sm:text-sm mt-1">Kelola tahun dan semester</p>
          </Link>

          {/* Jenjang Pendidikan */}
          <Link
            href="/admin/levels"
            className="bg-white rounded-lg shadow hover:shadow-lg transition-all group border-l-4 border-purple-500 p-4 sm:p-6"
          >
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="p-2 sm:p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                <GraduationCap size={20} className="sm:w-6 sm:h-6 text-purple-600" />
              </div>
              <ArrowRight size={18} className="text-gray-300 group-hover:text-purple-600 transition-colors flex-shrink-0" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Jenjang Pendidikan</h3>
            <p className="text-gray-600 text-xs sm:text-sm mt-1">SD, SMP, SMA, Aliyah</p>
          </Link>

          {/* Mata Pelajaran */}
          <Link
            href="/admin/subjects"
            className="bg-white rounded-lg shadow hover:shadow-lg transition-all group border-l-4 border-orange-500 p-4 sm:p-6"
          >
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="p-2 sm:p-3 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                <BookOpen size={20} className="sm:w-6 sm:h-6 text-orange-600" />
              </div>
              <ArrowRight size={18} className="text-gray-300 group-hover:text-orange-600 transition-colors flex-shrink-0" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Mata Pelajaran</h3>
            <p className="text-gray-600 text-xs sm:text-sm mt-1">Kelola kurikulum</p>
          </Link>
        </div>
      </div>

      {/* Coming Soon Section */}
      <div>
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Fitur Lainnya</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Manajemen Raport */}
          <Link
            href="/admin/raports"
            className="bg-white rounded-lg shadow hover:shadow-lg transition-all group border-l-4 border-indigo-500 p-4 sm:p-6"
          >
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="p-2 sm:p-3 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
                <FileText size={20} className="sm:w-6 sm:h-6 text-indigo-600" />
              </div>
              <ArrowRight size={18} className="text-gray-300 group-hover:text-indigo-600 transition-colors flex-shrink-0" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Manajemen Raport</h3>
            <p className="text-gray-600 text-xs sm:text-sm mt-1">Lihat dan kelola semua raport</p>
          </Link>

          {/* Users */}
          <div className="bg-white rounded-lg shadow border-l-4 border-red-500 p-4 sm:p-6 opacity-60">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="p-2 sm:p-3 bg-red-100 rounded-lg">
                <Users size={20} className="sm:w-6 sm:h-6 text-red-600" />
              </div>
              <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-1 rounded whitespace-nowrap">
                Coming Soon
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Manajemen Pengguna</h3>
            <p className="text-gray-600 text-xs sm:text-sm mt-1">Kelola admin, guru, dan pengguna</p>
          </div>

          {/* Analytics */}
          <div className="bg-white rounded-lg shadow border-l-4 border-teal-500 p-4 sm:p-6 opacity-60">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="p-2 sm:p-3 bg-teal-100 rounded-lg">
                <BarChart3 size={20} className="sm:w-6 sm:h-6 text-teal-600" />
              </div>
              <span className="text-xs font-semibold bg-teal-100 text-teal-700 px-2 py-1 rounded whitespace-nowrap">
                Coming Soon
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Analytics & Laporan</h3>
            <p className="text-gray-600 text-xs sm:text-sm mt-1">Lihat statistik dan laporan</p>
          </div>
        </div>
      </div>
    </div>
  );
}
