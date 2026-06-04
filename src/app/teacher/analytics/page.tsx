'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3, BookOpen, CheckCircle, Filter, Users, TrendingUp,
  AlertCircle, Loader
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { getCurrentUser } from '@/lib/auth/client';
import { devError } from '@/lib/dev-log';

interface TeacherStats {
  totalClasses: number;
  totalStudents: number;
  totalSubjects: number;
  averageAttendance: number;
  gradesSubmitted: number;
  pendingGrades: number;
}

interface ClassData {
  id: string;
  name: string;
  studentCount: number;
  attendanceRate: number;
  gradesCompleted: number;
}

interface Class {
  id: string;
  name: string;
}

export default function TeacherAnalyticsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [classesData, setClassesData] = useState<ClassData[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      // Fetch teacher stats
      const statsRes = await apiFetch('/api/teacher/analytics');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data);
      }

      // Fetch teacher classes
      const classesRes = await apiFetch('/api/teacher/classes');
      if (classesRes.ok) {
        const classesData = await classesRes.json();
        setClasses(classesData.data || []);
      }

      // Fetch classes analytics data
      const params = new URLSearchParams();
      if (selectedClass) params.append('classId', selectedClass);
      
      const classAnalyticsRes = await apiFetch(`/api/teacher/analytics/classes?${params}`);
      if (classAnalyticsRes.ok) {
        const classAnalyticsData = await classAnalyticsRes.json();
        setClassesData(classAnalyticsData.data || []);
      }
    } catch (error) {
      devError('Error fetching analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedClass]);

  useEffect(() => {
    const userData = getCurrentUser();
    if (!userData) {
      router.push('/login');
      return;
    }
    if (userData.role !== 'TEACHER') {
      router.push('/admin/dashboard');
      return;
    }

    void fetchData();
  }, [fetchData, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader size={48} className="text-indigo-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-2 text-sm sm:text-base">Analisis data kelas dan siswa Anda</p>
      </div>

      {/* Filter Section */}
      {classes.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={20} className="text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filter Kelas</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium text-gray-900 bg-white"
            >
              <option value="">-- Semua Kelas --</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
            {selectedClass && (
              <button
                onClick={() => setSelectedClass('')}
                className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Total Classes */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border-l-4 border-indigo-600">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-gray-600 text-sm font-medium">Total Kelas</p>
              <p className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2">{stats?.totalClasses || 0}</p>
              <p className="text-xs text-gray-500 mt-2">Kelas yang Anda ajar</p>
            </div>
            <div className="bg-indigo-100 p-3 rounded-lg flex-shrink-0">
              <BookOpen size={24} className="text-indigo-600" />
            </div>
          </div>
        </div>

        {/* Total Students */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border-l-4 border-blue-600">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-gray-600 text-sm font-medium">Total Siswa</p>
              <p className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2">{stats?.totalStudents || 0}</p>
              <p className="text-xs text-gray-500 mt-2">Di semua kelas Anda</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg flex-shrink-0">
              <Users size={24} className="text-blue-600" />
            </div>
          </div>
        </div>

        {/* Total Subjects */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border-l-4 border-purple-600">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-gray-600 text-sm font-medium">Mata Pelajaran</p>
              <p className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2">{stats?.totalSubjects || 0}</p>
              <p className="text-xs text-gray-500 mt-2">Yang Anda ajarkan</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg flex-shrink-0">
              <BarChart3 size={24} className="text-purple-600" />
            </div>
          </div>
        </div>

        {/* Average Attendance */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border-l-4 border-green-600">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-gray-600 text-sm font-medium">Rata-rata Absensi</p>
              <p className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2">{stats?.averageAttendance || 0}%</p>
              <p className="text-xs text-gray-500 mt-2">Tingkat kehadiran siswa</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg flex-shrink-0">
              <CheckCircle size={24} className="text-green-600" />
            </div>
          </div>
        </div>

        {/* Grades Submitted */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border-l-4 border-orange-600">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-gray-600 text-sm font-medium">Nilai Diisi</p>
              <p className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2">{stats?.gradesSubmitted || 0}</p>
              <p className="text-xs text-gray-500 mt-2">Nilai yang sudah diinput</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg flex-shrink-0">
              <TrendingUp size={24} className="text-orange-600" />
            </div>
          </div>
        </div>

        {/* Pending Grades */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border-l-4 border-red-600">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-gray-600 text-sm font-medium">Menunggu Input</p>
              <p className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2">{stats?.pendingGrades || 0}</p>
              <p className="text-xs text-gray-500 mt-2">Nilai yang belum diinput</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg flex-shrink-0">
              <AlertCircle size={24} className="text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Classes Breakdown */}
      {classesData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Rincian Kelas</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Nama Kelas</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Jumlah Siswa</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Absensi</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Nilai Selesai</th>
                </tr>
              </thead>
              <tbody>
                {classesData.map((classItem) => (
                  <tr key={classItem.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-gray-900 font-medium">{classItem.name}</td>
                    <td className="py-3 px-4 text-center text-gray-600">{classItem.studentCount}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full transition-all"
                            style={{ width: `${classItem.attendanceRate}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-12 text-right">{classItem.attendanceRate}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all"
                            style={{ width: `${classItem.gradesCompleted}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-12 text-right">{classItem.gradesCompleted}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {classesData.length === 0 && !isLoading && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <BarChart3 size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Tidak ada data</h3>
          <p className="text-gray-600">Mulai dengan menginput nilai atau absensi untuk melihat analitik</p>
        </div>
      )}
    </div>
  );
}
