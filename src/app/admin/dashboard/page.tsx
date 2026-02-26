'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Users, BarChart3, BookOpen, Calendar, GraduationCap, ArrowRight, FileText, School, BookMarked } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface Statistics {
  schools: number;
  schoolYears: number;
  levels: number;
  classes: number;
  subjects: number;
  students: number;
  teachers: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statistics, setStatistics] = useState<Statistics>({
    schools: 0,
    schoolYears: 0,
    levels: 0,
    classes: 0,
    subjects: 0,
    students: 0,
    teachers: 0,
  });

  useEffect(() => {
    // Check after component mounts and localStorage is accessible
    const checkAuth = () => {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) {
        router.push('/login');
        return;
      }

      try {
        const userData = JSON.parse(storedUser);
        if (userData.role !== 'ADMIN' && userData.role !== 'PRINCIPAL') {
          router.push('/teacher/dashboard');
          return;
        }

        setUser(userData);
        setIsLoading(false);
      } catch (error) {
        console.error('Error parsing user data:', error);
        router.push('/login');
      }
    };

    // Small delay to ensure localStorage is ready
    const timer = setTimeout(checkAuth, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user) {
      fetchStatistics();
    }
  }, [user]);

  async function fetchStatistics() {
    try {
      const token = localStorage.getItem('accessToken');
      
      const [schoolsRes, schoolYearsRes, levelsRes, classesRes, subjectsRes, studentsRes, teachersRes] = await Promise.all([
        fetch('/api/admin/schools?limit=1000', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/school-years?limit=1000', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/levels?limit=1000', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/classes?limit=1000', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/subjects?limit=1000', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/students?limit=1000', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/users?limit=1000&role=TEACHER', { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);

      const [schools, schoolYears, levels, classes, subjects, students, teachers] = await Promise.all([
        schoolsRes.json(),
        schoolYearsRes.json(),
        levelsRes.json(),
        classesRes.json(),
        subjectsRes.json(),
        studentsRes.json(),
        teachersRes.json(),
      ]);

      setStatistics({
        schools: schools.pagination?.total || schools.data?.length || 0,
        schoolYears: schoolYears.pagination?.total || schoolYears.data?.length || 0,
        levels: levels.pagination?.total || levels.data?.length || 0,
        classes: classes.pagination?.total || classes.data?.length || 0,
        subjects: subjects.pagination?.total || subjects.data?.length || 0,
        students: students.pagination?.total || students.data?.length || 0,
        teachers: teachers.pagination?.total || teachers.data?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  }

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

      {/* Statistics Section */}
      <div>
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Statistik</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
          {/* Total Sekolah */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 sm:p-4 border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <Building2 size={18} className="sm:w-6 sm:h-6 text-blue-600" />
              <span className="text-2xl sm:text-3xl font-bold text-blue-600">{statistics.schools}</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-700">Sekolah</p>
          </div>

          {/* Total Tahun Ajaran */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 sm:p-4 border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <Calendar size={18} className="sm:w-6 sm:h-6 text-green-600" />
              <span className="text-2xl sm:text-3xl font-bold text-green-600">{statistics.schoolYears}</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-700">Tahun Ajaran</p>
          </div>

          {/* Total Jenjang */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 sm:p-4 border border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <GraduationCap size={18} className="sm:w-6 sm:h-6 text-purple-600" />
              <span className="text-2xl sm:text-3xl font-bold text-purple-600">{statistics.levels}</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-700">Jenjang</p>
          </div>

          {/* Total Kelas */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 sm:p-4 border border-orange-200">
            <div className="flex items-center justify-between mb-2">
              <School size={18} className="sm:w-6 sm:h-6 text-orange-600" />
              <span className="text-2xl sm:text-3xl font-bold text-orange-600">{statistics.classes}</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-700">Kelas</p>
          </div>

          {/* Total Mata Pelajaran */}
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-3 sm:p-4 border border-indigo-200">
            <div className="flex items-center justify-between mb-2">
              <BookMarked size={18} className="sm:w-6 sm:h-6 text-indigo-600" />
              <span className="text-2xl sm:text-3xl font-bold text-indigo-600">{statistics.subjects}</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-700">Mata Pelajaran</p>
          </div>

          {/* Total Siswa */}
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3 sm:p-4 border border-red-200">
            <div className="flex items-center justify-between mb-2">
              <Users size={18} className="sm:w-6 sm:h-6 text-red-600" />
              <span className="text-2xl sm:text-3xl font-bold text-red-600">{statistics.students}</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-700">Siswa</p>
          </div>

          {/* Total Guru */}
          <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg p-3 sm:p-4 border border-teal-200">
            <div className="flex items-center justify-between mb-2">
              <Users size={18} className="sm:w-6 sm:h-6 text-teal-600" />
              <span className="text-2xl sm:text-3xl font-bold text-teal-600">{statistics.teachers}</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-700">Guru</p>
          </div>
        </div>
      </div>
    </div>
  );
}
