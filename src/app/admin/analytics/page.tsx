'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, GraduationCap, BookOpen, TrendingUp, Filter } from 'lucide-react';

interface Stats {
  totalUsers: number;
  totalStudents: number;
  totalSubjects: number;
  totalClasses: number;
}

interface SchoolYear {
  id: string;
  year: string;
}

interface Level {
  id: string;
  name: string;
}

interface Class {
  id: string;
  name: string;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  
  const [filterSchoolYear, setFilterSchoolYear] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterClass, setFilterClass] = useState('');

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      router.push('/login');
      return;
    }

    fetchFilterOptions();
    fetchStats();
  }, [router, filterSchoolYear, filterLevel, filterClass]);

  async function fetchFilterOptions() {
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [yearsRes, levelsRes, classesRes] = await Promise.all([
        fetch('/api/admin/school-years?limit=100', { headers }),
        fetch('/api/admin/levels?limit=100', { headers }),
        fetch('/api/admin/classes?limit=100', { headers }),
      ]);

      const yearsData = await yearsRes.json();
      const levelsData = await levelsRes.json();
      const classesData = await classesRes.json();

      setSchoolYears(yearsData.data || []);
      setLevels(levelsData.data || []);
      setClasses(classesData.data || []);
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  }

  async function fetchStats() {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      
      const headers = {
        'Authorization': `Bearer ${token}`,
      };

      // Build query parameters
      const params = new URLSearchParams();
      params.append('limit', '1000');
      if (filterSchoolYear) params.append('schoolYearId', filterSchoolYear);
      if (filterLevel) params.append('levelId', filterLevel);
      if (filterClass) params.append('classId', filterClass);

      // Fetch statistics with filters
      const [usersRes, studentsRes, subjectsRes, classesRes] = await Promise.all([
        fetch(`/api/admin/users?${params}`, { headers }),
        fetch(`/api/admin/students?${params}`, { headers }).catch(() => null),
        fetch(`/api/admin/subjects?${params}`, { headers }),
        fetch(`/api/admin/classes?${params}`, { headers }),
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
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm sm:text-base">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-2 text-sm sm:text-base">Statistik dan laporan sistem manajemen raport</p>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filter Data</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Filter Tahun Akademik */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tahun Akademik
            </label>
            <select
              value={filterSchoolYear}
              onChange={(e) => setFilterSchoolYear(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-sm sm:text-base text-gray-900 bg-white"
            >
              <option value="">-- Semua Tahun --</option>
              {schoolYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.year}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Jenjang */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Jenjang Pendidikan
            </label>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-sm sm:text-base text-gray-900 bg-white"
            >
              <option value="">-- Semua Jenjang --</option>
              {levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Kelas */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Kelas
            </label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-sm sm:text-base text-gray-900 bg-white"
            >
              <option value="">-- Semua Kelas --</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Reset Button */}
        {(filterSchoolYear || filterLevel || filterClass) && (
          <div className="pt-2">
            <button
              onClick={() => {
                setFilterSchoolYear('');
                setFilterLevel('');
                setFilterClass('');
              }}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 underline"
            >
              Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-xs sm:text-sm font-medium">Total Pengguna</p>
              <p className="text-xl sm:text-3xl font-bold text-gray-900 mt-2">{stats?.totalUsers || 0}</p>
            </div>
            <Users className="w-6 sm:w-10 h-6 sm:h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-xs sm:text-sm font-medium">Total Siswa</p>
              <p className="text-xl sm:text-3xl font-bold text-gray-900 mt-2">{stats?.totalStudents || 0}</p>
            </div>
            <GraduationCap className="w-6 sm:w-10 h-6 sm:h-10 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-xs sm:text-sm font-medium">Total Mata Pelajaran</p>
              <p className="text-xl sm:text-3xl font-bold text-gray-900 mt-2">{stats?.totalSubjects || 0}</p>
            </div>
            <BookOpen className="w-6 sm:w-10 h-6 sm:h-10 text-purple-500" />
          </div>
        </div>

        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-xs sm:text-sm font-medium">Total Kelas</p>
              <p className="text-xl sm:text-3xl font-bold text-gray-900 mt-2">{stats?.totalClasses || 0}</p>
            </div>
            <TrendingUp className="w-6 sm:w-10 h-6 sm:h-10 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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

      {/* Detailed Statistics */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Statistik Detail</h2>
        
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
              <p className="text-xs sm:text-sm text-blue-700 font-medium mb-2">Rata-rata Siswa per Kelas</p>
              <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                {stats.totalClasses > 0 ? Math.round(stats.totalStudents / stats.totalClasses) : 0}
              </p>
            </div>

            <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
              <p className="text-xs sm:text-sm text-green-700 font-medium mb-2">Rata-rata Mata Pelajaran per Kelas</p>
              <p className="text-2xl sm:text-3xl font-bold text-green-600">
                {stats.totalClasses > 0 ? Math.round(stats.totalSubjects / stats.totalClasses) : 0}
              </p>
            </div>

            <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
              <p className="text-xs sm:text-sm text-purple-700 font-medium mb-2">Total Entitas Sistem</p>
              <p className="text-2xl sm:text-3xl font-bold text-purple-600">
                {stats.totalUsers + stats.totalStudents + stats.totalSubjects + stats.totalClasses}
              </p>
            </div>

            <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg">
              <p className="text-xs sm:text-sm text-orange-700 font-medium mb-2">Data Completion</p>
              <p className="text-2xl sm:text-3xl font-bold text-orange-600">
                {stats.totalStudents > 0 && stats.totalClasses > 0 ? '✓ 100%' : '⚠ Incomplete'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
