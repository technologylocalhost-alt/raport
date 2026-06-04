'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle, BarChart3, BookOpen, CheckCircle,
  Clock, Users, TrendingUp, Loader, GraduationCap
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { clearAuthData, getCurrentUser } from '@/lib/auth/client';
import { devError } from '@/lib/dev-log';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface ActivityItem {
  id: string;
  type: 'grade' | 'attendance' | 'competency';
  title: string;
  description: string;
  timestamp: string;
  activityType: 'info' | 'warning' | 'success';
}

interface SubjectTeacher {
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
}

interface DashboardStats {
  className: string;
  totalStudents: number;
  totalSubjects: number;
  presentToday: number;
  attendanceRate: number;
  recentActivities: ActivityItem[];
  subjectTeachers: SubjectTeacher[];
}

interface StatCard {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  subtext?: string;
}

// Components
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Loader size={48} className="text-indigo-600 mx-auto mb-4 animate-spin" />
        <p className="text-gray-600 font-medium">Loading...</p>
      </div>
    </div>
  );
}

function WelcomeCard({ name, className }: { name: string; className: string }) {
  return (
    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg shadow-lg p-6 sm:p-8 text-white">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Selamat Datang, {name}! 👋</h1>
        <p className="text-emerald-100 mt-1 text-xs sm:text-sm font-medium">Kelas: {className}</p>
        <p className="text-emerald-50 mt-2 text-sm sm:text-base">
          Kelola siswa, absensi, dan penilaian kelas Anda dengan mudah
        </p>
      </div>
    </div>
  );
}

interface StatCardComponentProps {
  stat: StatCard;
}

function StatCardComponent({ stat }: StatCardComponentProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border-t-4" style={{ borderColor: stat.color }}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-600 text-sm font-medium">{stat.label}</p>
          <p className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2">{stat.value}</p>
          {stat.subtext && <p className="text-xs text-gray-500 mt-2">{stat.subtext}</p>}
        </div>
        <div 
          className="p-3 rounded-lg flex-shrink-0"
          style={{ backgroundColor: stat.color + '20', color: stat.color }}
        >
          {stat.icon}
        </div>
      </div>
    </div>
  );
}

function StatsSection({ stats }: { stats: DashboardStats }) {
  const statCards: StatCard[] = [
    {
      icon: <Users size={24} />,
      label: 'Total Siswa',
      value: stats.totalStudents,
      color: '#3b82f6',
      subtext: 'Di kelas Anda',
    },
    {
      icon: <BookOpen size={24} />,
      label: 'Mata Pelajaran',
      value: stats.totalSubjects,
      color: '#8b5cf6',
      subtext: 'Diajarkan di kelas',
    },
    {
      icon: <CheckCircle size={24} />,
      label: 'Hadir Hari Ini',
      value: stats.presentToday,
      color: '#10b981',
      subtext: 'Siswa yang hadir',
    },
    {
      icon: <TrendingUp size={24} />,
      label: 'Rata-rata Absensi',
      value: `${stats.attendanceRate}%`,
      color: '#f59e0b',
      subtext: 'Tingkat kehadiran',
    },
  ];

  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
        <BarChart3 size={24} className="text-emerald-600" />
        Ringkasan Data
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {statCards.map((stat, idx) => (
          <StatCardComponent key={idx} stat={stat} />
        ))}
      </div>
    </section>
  );
}

function getRelativeActivityTime(timestamp: string) {
  const diff = new Date().getTime() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes}m yang lalu`;
  if (hours < 24) return `${hours}h yang lalu`;
  return `${days}d yang lalu`;
}

function ActivityItemComponent({ activity }: { activity: ActivityItem }) {
  const iconMap = {
    info: <BarChart3 size={20} className="text-blue-600" />,
    warning: <AlertCircle size={20} className="text-yellow-600" />,
    success: <CheckCircle size={20} className="text-green-600" />,
  };

  const bgColorMap = {
    info: 'bg-blue-50 border-l-4 border-blue-600',
    warning: 'bg-yellow-50 border-l-4 border-yellow-600',
    success: 'bg-green-50 border-l-4 border-green-600',
  };

  return (
    <div className={`p-4 rounded-lg ${bgColorMap[activity.activityType]}`}>
      <div className="flex items-start gap-3">
        {iconMap[activity.activityType]}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm">{activity.title}</p>
          <p className="text-gray-600 text-xs mt-1">{activity.description}</p>
          <p className="text-gray-500 text-xs mt-1">{getRelativeActivityTime(activity.timestamp)}</p>
        </div>
      </div>
    </div>
  );
}

function SubjectsTeachersSection({ subjects }: { subjects: SubjectTeacher[] }) {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
        <GraduationCap size={24} className="text-emerald-600" />
        Mata Pelajaran & Guru
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.length > 0 ? (
          subjects.map((item) => (
            <div key={item.subjectId} className="bg-white rounded-lg shadow-md p-4 sm:p-5 border-l-4 border-emerald-600">
              <div className="space-y-2">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Mata Pelajaran</p>
                  <p className="text-lg font-bold text-gray-900">{item.subjectName}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm font-medium">Guru Pengajar</p>
                  <p className="text-base font-semibold text-emerald-700">{item.teacherName}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-8 text-gray-500">
            <BookOpen size={40} className="mx-auto mb-2 opacity-30" />
            <p>Belum ada mata pelajaran ditugaskan</p>
          </div>
        )}
      </div>
    </section>
  );
}

function RecentActivitySection({ activities }: { activities: ActivityItem[] }) {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
        <Clock size={24} className="text-emerald-600" />
        Aktivitas Terbaru
      </h2>
      <div className="space-y-3">
        {activities.length > 0 ? (
          activities.map((activity) => (
            <ActivityItemComponent key={activity.id} activity={activity} />
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Clock size={40} className="mx-auto mb-2 opacity-30" />
            <p>Belum ada aktivitas</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function WaliKelasDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      if (!getCurrentUser()) {
        router.push('/login');
        return;
      }

      const res = await apiFetch('/api/wali-kelas/dashboard');

      if (res.status === 401) {
        clearAuthData();
        router.push('/login');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setStats(data.data);
      }
    } catch (error) {
      devError('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const parsedUser = getCurrentUser() as User | null;
    if (!parsedUser) {
      router.push('/login');
      return;
    }
    if (parsedUser.role !== 'WALI_KELAS') {
      router.push('/admin/dashboard');
      return;
    }

    setUser(parsedUser);
    void fetchStats();
  }, [fetchStats, router]);

  if (isLoading || !stats) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <WelcomeCard 
        name={user?.name || 'Wali Kelas'} 
        className={stats.className}
      />

      <StatsSection stats={stats} />

      <SubjectsTeachersSection subjects={stats.subjectTeachers} />

      <RecentActivitySection activities={stats.recentActivities} />
    </div>
  );
}
