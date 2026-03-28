'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  AlertCircle, ArrowRight, BarChart3, BookOpen, CheckCircle, 
  Clock, Users, TrendingUp
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface DashboardStats {
  totalClasses: number;
  totalStudents: number;
  pendingGrades: number;
  attendanceToday: number;
  recentActivities: ActivityItem[];
}

interface ActivityItem {
  id: string;
  type: 'grade' | 'attendance' | 'competency';
  title: string;
  description: string;
  timestamp: string;
  activityType: 'info' | 'warning' | 'success';
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Loading...</p>
      </div>
    </div>
  );
}

function WelcomeCard({ name }: { name: string }) {
  return (
    <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-lg shadow-lg p-6 sm:p-8 text-white">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Selamat Datang, {name}! 👋</h1>
        <p className="text-indigo-100 mt-2 text-sm sm:text-base">
          Kelola nilai, siswa, dan absensi kelas Anda dengan mudah dan efisien
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
      icon: <BookOpen size={24} />,
      label: 'Kelas Aktif',
      value: stats.totalClasses,
      color: '#3b82f6',
      subtext: 'Kelas yang Anda ajar',
    },
    {
      icon: <Users size={24} />,
      label: 'Total Siswa',
      value: stats.totalStudents,
      color: '#8b5cf6',
      subtext: 'Di semua kelas Anda',
    },
    {
      icon: <Clock size={24} />,
      label: 'Menunggu Input',
      value: stats.pendingGrades,
      color: '#f59e0b',
      subtext: 'Nilai yang perlu diinput',
    },
    {
      icon: <CheckCircle size={24} />,
      label: 'Absensi Hari Ini',
      value: `${stats.attendanceToday}%`,
      color: '#10b981',
      subtext: 'Tingkat kehadiran',
    },
  ];

  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
        <BarChart3 size={24} className="text-indigo-600" />
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
    <div className={`rounded-lg p-4 ${bgColorMap[activity.activityType]}`}>
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">{iconMap[activity.activityType]}</div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">{activity.title}</p>
          <p className="text-gray-600 text-sm mt-1">{activity.description}</p>
          <p className="text-xs text-gray-500 mt-2">{activity.timestamp}</p>
        </div>
      </div>
    </div>
  );
}

function RecentActivitySection({ activities }: { activities: ActivityItem[] }) {
  if (activities.length === 0) {
    return (
      <section>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
          <Clock size={24} className="text-gray-600" />
          Aktivitas Terbaru
        </h2>
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-600">Belum ada aktivitas terbaru</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
        <Clock size={24} className="text-gray-600" />
        Aktivitas Terbaru
      </h2>
      <div className="space-y-3">
        {activities.map((activity) => (
          <ActivityItemComponent key={activity.id} activity={activity} />
        ))}
      </div>
    </section>
  );
}

// Main Component
export default function TeacherDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalClasses: 0,
    totalStudents: 0,
    pendingGrades: 0,
    attendanceToday: 0,
    recentActivities: [],
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
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

        // Fetch dashboard stats from API
        const token = localStorage.getItem('accessToken');
        if (token) {
          try {
            const response = await fetch('/api/teacher/dashboard', {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });

            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data) {
                setStats(result.data);
              }
            } else if (response.status === 401) {
              console.error('Unauthorized: Token may be invalid or expired');
              localStorage.removeItem('accessToken');
              localStorage.removeItem('user');
              router.push('/login');
            } else {
              console.error('Failed to fetch dashboard stats:', response.statusText);
            }
          } catch (fetchError) {
            console.error('Error fetching dashboard stats:', fetchError);
          }
        } else {
          console.warn('No access token found in localStorage');
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
        setHasError(true);
        setTimeout(() => router.push('/login'), 1000);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(checkAuth, 0);
    return () => clearTimeout(timer);
  }, [router]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (hasError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md px-4">
          <AlertCircle size={48} className="mx-auto text-red-600 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Terjadi Kesalahan</h2>
          <p className="text-gray-600 mb-6">Tidak dapat memuat data pengguna. Silahkan login kembali.</p>
          <Link href="/login" className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700">
            Kembali ke Login
          </Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      <WelcomeCard name={user.name} />
      <StatsSection stats={stats} />
      <RecentActivitySection activities={stats.recentActivities} />
    </div>
  );
}
