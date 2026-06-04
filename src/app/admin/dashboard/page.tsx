'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Users, Calendar, GraduationCap, School, BookMarked } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { getCurrentUser } from '@/lib/auth/client';
import { devError } from '@/lib/dev-log';

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

interface Stats {
  totalUsers: number;
  totalStudents: number;
  totalSubjects: number;
  totalClasses: number;
}

interface ActiveSemester {
  id: string;
  number: number;
  semesterLabel?: string;
  semesterLabelArabic?: string;
  isActive: boolean;
}

interface ActiveSchoolYear {
  id: string;
  year: string;
  tahunAkademik?: string;
  tahunAkademikArabic?: string;
  startDate: string;
  endDate: string;
  isActive?: boolean;
  semesters?: ActiveSemester[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSchoolYear, setActiveSchoolYear] = useState<ActiveSchoolYear | null>(null);
  const [statistics, setStatistics] = useState<Statistics>({
    schools: 0,
    schoolYears: 0,
    levels: 0,
    classes: 0,
    subjects: 0,
    students: 0,
    teachers: 0,
  });
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      const userData = getCurrentUser();
      if (!userData) {
        router.push('/login');
        return;
      }

      try {
        if (userData.role !== 'ADMIN' && userData.role !== 'PRINCIPAL') {
          router.push('/teacher/dashboard');
          return;
        }

        setUser(userData);
        setIsLoading(false);
      } catch (error) {
        devError('Error parsing user data:', error);
        router.push('/login');
      }
    };

    const timer = setTimeout(checkAuth, 0);
    return () => clearTimeout(timer);
  }, [router]);

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('limit', '1000');

      const [usersRes, studentsRes, subjectsRes, classesRes] = await Promise.all([
        apiFetch(`/api/admin/users?${params}`),
        apiFetch(`/api/admin/students?${params}`).catch(() => null),
        apiFetch(`/api/admin/subjects?${params}`),
        apiFetch(`/api/admin/classes?${params}`),
      ]);

      const usersData = await usersRes.json();
      const studentsData = studentsRes ? await studentsRes.json() : null;
      const subjectsData = await subjectsRes.json();
      const classesData = await classesRes.json();

      setStats({
        totalUsers: usersData.total || usersData.pagination?.total || 0,
        totalStudents: studentsData?.total || studentsData?.pagination?.total || 0,
        totalSubjects: subjectsData.total || subjectsData.pagination?.total || 0,
        totalClasses: classesData.total || classesData.pagination?.total || 0,
      });
    } catch (error) {
      devError('Error fetching stats:', error);
    }
  }, []);

  const fetchStatistics = useCallback(async () => {
    try {
      // First, get active school year
      const schoolYearsRes = await apiFetch('/api/admin/school-years?limit=1000');
      const schoolYearsData = await schoolYearsRes.json();
      
      // Find the active school year
      const activeSchoolYearData = (schoolYearsData.data as ActiveSchoolYear[] | undefined)?.find((sy) => sy.isActive);
      const activeSchoolYearId = activeSchoolYearData?.id;

      // Set active school year
      if (activeSchoolYearData) {
        setActiveSchoolYear(activeSchoolYearData);
      }

      // Get the active semester from active school year
      let activeSemesterId = null;
      if (activeSchoolYearData?.semesters && activeSchoolYearData.semesters.length > 0) {
        const activeSem = activeSchoolYearData.semesters.find((sem) => sem.isActive);
        activeSemesterId = activeSem?.id;
      }

      // Build query parameters for filtering by active school year
      const schoolYearParam = activeSchoolYearId ? `?schoolYearId=${activeSchoolYearId}` : '';
      const semesterParam = activeSemesterId ? `?semesterId=${activeSemesterId}` : '';

      // For classes, we rely on the API's default active filtering
      const [schoolsRes, levelsRes, classesRes, teachersRes] = await Promise.all([
        apiFetch('/api/admin/schools?limit=1000'),
        apiFetch('/api/admin/levels?limit=1000'),
        apiFetch('/api/admin/classes?limit=1000'),
        apiFetch('/api/admin/users?limit=1000&role=TEACHER'),
      ]);

      // For students and subjects, filter by active school year/semester
      const [studentsRes, subjectsRes] = await Promise.all([
        apiFetch(`/api/admin/students${schoolYearParam}&limit=1000`),
        apiFetch(`/api/admin/subjects${semesterParam}&limit=1000`),
      ]);

      const [schools, levels, classes, teachers, students, subjects] = await Promise.all([
        schoolsRes.json(),
        levelsRes.json(),
        classesRes.json(),
        teachersRes.json(),
        studentsRes.json(),
        subjectsRes.json(),
      ]);

      setStatistics({
        schools: schools.pagination?.total || schools.data?.length || 0,
        schoolYears: 1, // Only count active school year
        levels: levels.pagination?.total || levels.data?.length || 0,
        classes: classes.pagination?.total || classes.data?.length || 0,
        subjects: subjects.pagination?.total || subjects.data?.length || 0,
        students: students.pagination?.total || students.data?.length || 0,
        teachers: teachers.pagination?.total || teachers.data?.length || 0,
      });
    } catch (error) {
      devError('Error fetching statistics:', error);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const timer = setTimeout(() => {
      void fetchStatistics();
      void fetchStats();
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchStatistics, fetchStats, user]);

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

      {/* Active School Year Info */}
      {activeSchoolYear && (
        <div className="bg-white rounded-lg shadow-md border-l-4 border-green-500 p-4 sm:p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Tahun Ajaran Aktif</h2>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  <span className="text-sm sm:text-base">
                    <span className="font-semibold text-gray-700">{activeSchoolYear.year}</span>
                    {activeSchoolYear.tahunAkademik && (
                      <span className="text-gray-600"> • {activeSchoolYear.tahunAkademik}</span>
                    )}
                  </span>
                </div>
                {activeSchoolYear.tahunAkademikArabic && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm sm:text-base text-right" dir="rtl">
                      <span className="font-semibold text-gray-700">{activeSchoolYear.tahunAkademikArabic}</span>
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm text-gray-600">
                    {new Date(activeSchoolYear.startDate).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })} - {new Date(activeSchoolYear.endDate).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>
            {activeSchoolYear.semesters && activeSchoolYear.semesters.length > 0 && (
              <div className="mt-3 sm:mt-0 sm:ml-4">
                <div className="bg-green-50 rounded p-3 text-center">
                  <div className="text-xs sm:text-sm text-gray-600 mb-1">Semester Aktif</div>
                  {activeSchoolYear.semesters
                    .filter(sem => sem.isActive)
                    .map(sem => (
                      <div key={sem.id} className="font-bold text-green-600 text-sm sm:text-base">
                        {sem.semesterLabel || `Semester ${sem.number}`}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Two Column Section: Statistics & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Statistics Sekolah */}
        <div className="lg:col-span-1">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Statistik Sekolah</h2>
          <div className="space-y-3">
            {/* Total Sekolah */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <Building2 size={20} className="text-blue-600" />
                <span className="text-2xl font-bold text-blue-600">{statistics.schools}</span>
              </div>
              <p className="text-sm text-gray-700">Sekolah</p>
            </div>

            {/* Total Tahun Ajaran */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <Calendar size={20} className="text-green-600" />
                <span className="text-2xl font-bold text-green-600">{statistics.schoolYears}</span>
              </div>
              <p className="text-sm text-gray-700">Tahun Ajaran</p>
            </div>

            {/* Total Jenjang */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <GraduationCap size={20} className="text-purple-600" />
                <span className="text-2xl font-bold text-purple-600">{statistics.levels}</span>
              </div>
              <p className="text-sm text-gray-700">Jenjang</p>
            </div>

            {/* Total Kelas */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <School size={20} className="text-orange-600" />
                <span className="text-2xl font-bold text-orange-600">{statistics.classes}</span>
              </div>
              <p className="text-sm text-gray-700">Kelas</p>
            </div>

            {/* Total Mata Pelajaran */}
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4 border border-indigo-200">
              <div className="flex items-center justify-between mb-2">
                <BookMarked size={20} className="text-indigo-600" />
                <span className="text-2xl font-bold text-indigo-600">{statistics.subjects}</span>
              </div>
              <p className="text-sm text-gray-700">Mata Pelajaran</p>
            </div>

            {/* Total Siswa */}
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
              <div className="flex items-center justify-between mb-2">
                <Users size={20} className="text-red-600" />
                <span className="text-2xl font-bold text-red-600">{statistics.students}</span>
              </div>
              <p className="text-sm text-gray-700">Siswa</p>
            </div>

            {/* Total Guru */}
            <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg p-4 border border-teal-200">
              <div className="flex items-center justify-between mb-2">
                <Users size={20} className="text-teal-600" />
                <span className="text-2xl font-bold text-teal-600">{statistics.teachers}</span>
              </div>
              <p className="text-sm text-gray-700">Guru</p>
            </div>
          </div>
        </div>

        {/* Right Column: Charts Section */}
        <div className="lg:col-span-2">
          <div className="space-y-6">
            {/* Stats Distribution Chart */}
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Distribusi Data Sistem</h2>
              
              {/* Pie Chart Style Visualization */}
              <div className="space-y-4">
                {stats && (
                  <>
                    {/* Pengguna */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                          <span className="text-sm font-medium text-gray-700">Pengguna</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{stats.totalUsers}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{
                            width: stats.totalUsers > 0 
                              ? `${(stats.totalUsers / (stats.totalUsers + stats.totalStudents + stats.totalSubjects + stats.totalClasses || 1)) * 100}%`
                              : '0%'
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Siswa */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <span className="text-sm font-medium text-gray-700">Siswa</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{stats.totalStudents}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full" 
                          style={{
                            width: stats.totalStudents > 0 
                              ? `${(stats.totalStudents / (stats.totalUsers + stats.totalStudents + stats.totalSubjects + stats.totalClasses || 1)) * 100}%`
                              : '0%'
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Mata Pelajaran */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                          <span className="text-sm font-medium text-gray-700">Mata Pelajaran</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{stats.totalSubjects}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-500 h-2 rounded-full" 
                          style={{
                            width: stats.totalSubjects > 0 
                              ? `${(stats.totalSubjects / (stats.totalUsers + stats.totalStudents + stats.totalSubjects + stats.totalClasses || 1)) * 100}%`
                              : '0%'
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Kelas */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                          <span className="text-sm font-medium text-gray-700">Kelas</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{stats.totalClasses}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-orange-500 h-2 rounded-full" 
                          style={{
                            width: stats.totalClasses > 0 
                              ? `${(stats.totalClasses / (stats.totalUsers + stats.totalStudents + stats.totalSubjects + stats.totalClasses || 1)) * 100}%`
                              : '0%'
                          }}
                        ></div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Summary Statistics */}
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Ringkasan Sistem</h2>
              
              <div className="space-y-4">
                {stats && (
                  <>
                    <div className="flex items-start justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <div>
                        <p className="text-xs sm:text-sm text-blue-600 font-medium">Total Pengguna</p>
                        <p className="text-2xl sm:text-3xl font-bold text-blue-600 mt-1">{stats.totalUsers}</p>
                      </div>
                      <div className="text-3xl sm:text-4xl text-blue-200">👥</div>
                    </div>

                    <div className="flex items-start justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                      <div>
                        <p className="text-xs sm:text-sm text-green-600 font-medium">Total Siswa Terdaftar</p>
                        <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-1">{stats.totalStudents}</p>
                      </div>
                      <div className="text-3xl sm:text-4xl text-green-200">🎓</div>
                    </div>

                    <div className="flex items-start justify-between p-3 bg-purple-50 rounded-lg border border-purple-100">
                      <div>
                        <p className="text-xs sm:text-sm text-purple-600 font-medium">Total Mata Pelajaran</p>
                        <p className="text-2xl sm:text-3xl font-bold text-purple-600 mt-1">{stats.totalSubjects}</p>
                      </div>
                      <div className="text-3xl sm:text-4xl text-purple-200">📚</div>
                    </div>

                    <div className="flex items-start justify-between p-3 bg-orange-50 rounded-lg border border-orange-100">
                      <div>
                        <p className="text-xs sm:text-sm text-orange-600 font-medium">Total Kelas Aktif</p>
                        <p className="text-2xl sm:text-3xl font-bold text-orange-600 mt-1">{stats.totalClasses}</p>
                      </div>
                      <div className="text-3xl sm:text-4xl text-orange-200">🏫</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
