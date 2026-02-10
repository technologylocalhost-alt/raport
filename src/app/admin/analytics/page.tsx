'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, GraduationCap, BookOpen, TrendingUp } from 'lucide-react';

interface Stats {
  totalUsers: number;
  totalStudents: number;
  totalSubjects: number;
  totalClasses: number;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      router.push('/login');
      return;
    }

    fetchStats();
  }, [router]);

  async function fetchStats() {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      
      const headers = {
        'Authorization': `Bearer ${token}`,
      };

      // Fetch statistics
      const [usersRes, studentsRes, subjectsRes, classesRes] = await Promise.all([
        fetch('/api/admin/users?limit=1', { headers }),
        fetch('/api/admin/students?limit=1', { headers }).catch(() => null),
        fetch('/api/admin/subjects?limit=1', { headers }),
        fetch('/api/admin/classes?limit=1', { headers }),
      ]);

      const usersData = await usersRes.json();
      const subjectsData = await subjectsRes.json();
      const classesData = await classesRes.json();

      setStats({
        totalUsers: usersData.total || 0,
        totalStudents: 0,
        totalSubjects: subjectsData.total || 0,
        totalClasses: classesData.total || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-2">Statistik dan laporan sistem manajemen raport</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Pengguna</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.totalUsers || 0}</p>
            </div>
            <Users className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Siswa</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.totalStudents || 0}</p>
            </div>
            <GraduationCap className="w-10 h-10 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Mata Pelajaran</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.totalSubjects || 0}</p>
            </div>
            <BookOpen className="w-10 h-10 text-purple-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Kelas</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.totalClasses || 0}</p>
            </div>
            <TrendingUp className="w-10 h-10 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Placeholder for charts */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Grafik & Trend</h2>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded border border-gray-200">
          <p className="text-gray-500">Fitur grafik akan segera tersedia</p>
        </div>
      </div>
    </div>
  );
}
