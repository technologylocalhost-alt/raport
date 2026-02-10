'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Users, FileText, CheckCircle, ArrowRight, Library, Target } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function TeacherDashboard() {
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
    if (userData.role !== 'TEACHER') {
      router.push('/admin/dashboard');
      return;
    }

    setUser(userData);
    setIsLoading(false);
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-lg shadow-lg p-8 text-white">
        <h1 className="text-3xl font-bold">Selamat Datang, {user?.name}! 👋</h1>
        <p className="text-indigo-100 mt-2">Kelola nilai, siswa, dan absensi kelas Anda dengan mudah dan efisien</p>
      </div>

      {/* Fitur Utama */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Fitur Utama</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Mata Pelajaran */}
          <Link href="/teacher/subjects">
            <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all border-l-4 border-purple-600 p-6 hover:translate-y-[-2px] cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="bg-purple-100 p-3 rounded-lg mb-3">
                    <Library className="text-purple-600" size={28} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Mata Pelajaran</h3>
                  <p className="text-gray-600 text-sm mt-1">Kelola semua mata pelajaran yang Anda ajar</p>
                </div>
              </div>
              <div className="flex items-center text-purple-600 font-medium text-sm group">
                Lihat <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          {/* Input Nilai */}
          <Link href="/teacher/grades">
            <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all border-l-4 border-indigo-600 p-6 hover:translate-y-[-2px] cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="bg-indigo-100 p-3 rounded-lg mb-3">
                    <BookOpen className="text-indigo-600" size={28} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Input Nilai</h3>
                  <p className="text-gray-600 text-sm mt-1">Input nilai siswa berdasarkan kompetensi dan pencapaian</p>
                </div>
              </div>
              <div className="flex items-center text-indigo-600 font-medium text-sm group">
                Buka <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          {/* Daftar Siswa */}
          <Link href="/teacher/students">
            <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all border-l-4 border-blue-600 p-6 hover:translate-y-[-2px] cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="bg-blue-100 p-3 rounded-lg mb-3">
                    <Users className="text-blue-600" size={28} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Daftar Siswa</h3>
                  <p className="text-gray-600 text-sm mt-1">Kelola dan lihat data siswa di kelas Anda</p>
                </div>
              </div>
              <div className="flex items-center text-blue-600 font-medium text-sm group">
                Lihat <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          {/* Absensi */}
          <Link href="/teacher/attendance">
            <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all border-l-4 border-green-600 p-6 hover:translate-y-[-2px] cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="bg-green-100 p-3 rounded-lg mb-3">
                    <CheckCircle className="text-green-600" size={28} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Absensi</h3>
                  <p className="text-gray-600 text-sm mt-1">Kelola data kehadiran siswa setiap hari</p>
                </div>
              </div>
              <div className="flex items-center text-green-600 font-medium text-sm group">
                Kelola <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>



          {/* Kompetensi */}
          <Link href="/teacher/competencies">
            <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all border-l-4 border-red-600 p-6 hover:translate-y-[-2px] cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="bg-red-100 p-3 rounded-lg mb-3">
                    <Target className="text-red-600" size={28} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Kompetensi</h3>
                  <p className="text-gray-600 text-sm mt-1">Kelola kompetensi dan capaian pembelajaran siswa</p>
                </div>
              </div>
              <div className="flex items-center text-red-600 font-medium text-sm group">
                Kelola <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Coming Soon Section */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Fitur Lainnya</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Analytics */}
          <div className="bg-white rounded-lg shadow-md border-l-4 border-purple-600 p-6 opacity-60">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="bg-purple-100 p-3 rounded-lg mb-3 w-fit">
                  <CheckCircle className="text-purple-600" size={28} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Analytics & Laporan</h3>
                <p className="text-gray-600 text-sm mt-1">Lihat statistik dan laporan performa siswa</p>
              </div>
              <div className="bg-purple-100 text-purple-600 text-xs font-semibold px-3 py-1 rounded-full">Coming Soon</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
