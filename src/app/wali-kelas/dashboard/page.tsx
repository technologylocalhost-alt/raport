'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, BookOpen, CheckCircle } from 'lucide-react';

interface DashboardStats {
  studentCount: number;
  subjectCount: number;
  attendanceCount: number;
}

export default function WaliKelasDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    studentCount: 0,
    subjectCount: 0,
    attendanceCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch dashboard stats
      const [studentsRes, subjectsRes] = await Promise.all([
        fetch('/api/admin/users?limit=1&role=STUDENT', { headers }),
        fetch('/api/admin/subjects?limit=1', { headers }),
      ]);

      let studentCount = 0;
      let subjectCount = 0;

      if (studentsRes.ok) {
        const data = await studentsRes.json();
        studentCount = data.meta?.total || 0;
      }

      if (subjectsRes.ok) {
        const data = await subjectsRes.json();
        subjectCount = data.meta?.total || 0;
      }

      setStats({
        studentCount,
        subjectCount,
        attendanceCount: 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const statCards = [
    {
      title: 'Jumlah Siswa',
      value: stats.studentCount,
      icon: Users,
      color: 'bg-blue-50 border-blue-200 text-blue-600',
      href: '/wali-kelas/students',
    },
    {
      title: 'Mata Pelajaran',
      value: stats.subjectCount,
      icon: BookOpen,
      color: 'bg-green-50 border-green-200 text-green-600',
      href: '/wali-kelas/subjects',
    },
    {
      title: 'Absensi',
      value: 0,
      icon: CheckCircle,
      color: 'bg-purple-50 border-purple-200 text-purple-600',
      href: '/wali-kelas/attendance',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Wali Kelas</h1>
        <p className="text-gray-600 mt-2">
          Selamat datang, {user?.name || 'Wali Kelas'} 👋
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              onClick={() => router.push(card.href)}
              className={`p-6 rounded-lg border-l-4 cursor-pointer hover:shadow-lg transition-all ${card.color}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    {card.title}
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {isLoading ? '-' : card.value}
                  </p>
                </div>
                <Icon size={40} className="opacity-20" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          📚 Sebagai Wali Kelas
        </h2>
        <p className="text-gray-700 mb-4">
          Kelola master data siswa, mata pelajaran, dan absensi kelas Anda dengan mudah.
        </p>
        <ul className="space-y-2 text-gray-700">
          <li className="flex items-center gap-2">
            <span className="text-emerald-600">✓</span>
            Lihat daftar lengkap siswa di kelas Anda
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-600">✓</span>
            Kelola mata pelajaran yang diajarkan
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-600">✓</span>
            Pantau absensi siswa secara real-time
          </li>
        </ul>
      </div>
    </div>
  );
}
