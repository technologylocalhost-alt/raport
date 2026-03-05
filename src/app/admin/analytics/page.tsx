'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, GraduationCap, BookOpen, TrendingUp, Filter, ChevronDown, ChevronUp } from 'lucide-react';

interface Stats {
  totalUsers: number;
  totalStudents: number;
  totalSubjects: number;
  totalClasses: number;
}

interface School {
  id: string;
  name: string;
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

interface Semester {
  id: string;
  number: number;
}

interface GradePerClass {
  classId: string;
  className: string;
  levelName: string;
  totalStudents: number;
  averageScore: number;
  students: Array<{
    id: string;
    name: string;
    studentNo: string;
    averageScore: number;
  }>;
}

interface SubjectGrade {
  subjectId: string;
  subjectName: string;
  averageScore: number;
}

interface SubjectGradesPerClass {
  classId: string;
  className: string;
  levelName: string;
  subjects: SubjectGrade[];
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  
  const [filterSchool, setFilterSchool] = useState('');
  const [filterSchoolYear, setFilterSchoolYear] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [semesters, setSemesters] = useState<Semester[]>([]);
  
  const [gradesPerClass, setGradesPerClass] = useState<GradePerClass[]>([]);
  const [isLoadingGrades, setIsLoadingGrades] = useState(false);
  const [expandedStudentClasses, setExpandedStudentClasses] = useState<Set<string>>(new Set());
  
  const [gradesPerSubject, setGradesPerSubject] = useState<SubjectGradesPerClass[]>([]);
  const [isLoadingSubjectGrades, setIsLoadingSubjectGrades] = useState(false);
  const [expandedSubjectClasses, setExpandedSubjectClasses] = useState<Set<string>>(new Set());

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      router.push('/login');
      return;
    }

    fetchFilterOptions();
    fetchStats();
    fetchGradesPerClass();
    fetchGradesPerSubject();
  }, [router, filterSchool, filterSchoolYear, filterLevel, filterClass, filterSemester]);

  // Fetch semesters when school year changes
  useEffect(() => {
    if (filterSchoolYear) {
      fetchSemestersBySchoolYear(filterSchoolYear);
      // Reset semester filter when school year changes
      setFilterSemester('');
    } else {
      setSemesters([]);
      setFilterSemester('');
    }
  }, [filterSchoolYear]);

  async function fetchFilterOptions() {
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [schoolsRes, yearsRes, levelsRes, classesRes] = await Promise.all([
        fetch('/api/admin/schools?limit=1000', { headers }),
        fetch('/api/admin/school-years?limit=100', { headers }),
        fetch('/api/admin/levels?limit=100', { headers }),
        fetch('/api/admin/classes?limit=100', { headers }),
      ]);

      const schoolsData = await schoolsRes.json();
      const yearsData = await yearsRes.json();
      const levelsData = await levelsRes.json();
      const classesData = await classesRes.json();

      setSchools(schoolsData.data || []);
      setSchoolYears(yearsData.data || []);
      setLevels(levelsData.data || []);
      setClasses(classesData.data || []);
      // Don't fetch semesters here - will fetch when school year is selected
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  }

  async function fetchSemestersBySchoolYear(schoolYearId: string) {
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { 'Authorization': `Bearer ${token}` };

      const semestersRes = await fetch(
        `/api/admin/semesters?limit=100&schoolYearId=${schoolYearId}`,
        { headers }
      );

      const semestersData = await semestersRes.json();
      setSemesters(semestersData.data || []);
    } catch (error) {
      console.error('Error fetching semesters:', error);
      setSemesters([]);
    }
  }

  const toggleStudentClassExpand = (classId: string) => {
    const newExpanded = new Set(expandedStudentClasses);
    if (newExpanded.has(classId)) {
      newExpanded.delete(classId);
    } else {
      newExpanded.add(classId);
    }
    setExpandedStudentClasses(newExpanded);
  };

  const toggleSubjectClassExpand = (classId: string) => {
    const newExpanded = new Set(expandedSubjectClasses);
    if (newExpanded.has(classId)) {
      newExpanded.delete(classId);
    } else {
      newExpanded.add(classId);
    }
    setExpandedSubjectClasses(newExpanded);
  };

  async function fetchGradesPerSubject() {
    try {
      setIsLoadingSubjectGrades(true);
      const token = localStorage.getItem('accessToken');
      const headers = { 'Authorization': `Bearer ${token}` };

      const params = new URLSearchParams();
      params.append('limit', '1000');
      if (filterSchool) params.append('schoolId', filterSchool);
      if (filterSchoolYear) params.append('schoolYearId', filterSchoolYear);
      if (filterLevel) params.append('levelId', filterLevel);
      if (filterSemester) params.append('semesterId', filterSemester);

      const res = await fetch(`/api/admin/grades/per-subject?${params}`, { headers });
      const data = await res.json();
      
      if (data.success) {
        setGradesPerSubject(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching grades per subject:', error);
    } finally {
      setIsLoadingSubjectGrades(false);
    }
  }

  async function fetchGradesPerClass() {
    try {
      setIsLoadingGrades(true);
      const token = localStorage.getItem('accessToken');
      const headers = { 'Authorization': `Bearer ${token}` };

      const params = new URLSearchParams();
      params.append('limit', '1000');
      if (filterSchool) params.append('schoolId', filterSchool);
      if (filterSchoolYear) params.append('schoolYearId', filterSchoolYear);
      if (filterLevel) params.append('levelId', filterLevel);
      if (filterSemester) params.append('semesterId', filterSemester);

      const res = await fetch(`/api/admin/grades/per-class?${params}`, { headers });
      const data = await res.json();
      
      if (data.success) {
        setGradesPerClass(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching grades per class:', error);
    } finally {
      setIsLoadingGrades(false);
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
      if (filterSchool) params.append('schoolId', filterSchool);
      if (filterSchoolYear) params.append('schoolYearId', filterSchoolYear);
      if (filterLevel) params.append('levelId', filterLevel);
      if (filterClass) params.append('classId', filterClass);
      if (filterSemester) params.append('semesterId', filterSemester);

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Filter Sekolah */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Sekolah
            </label>
            <select
              value={filterSchool}
              onChange={(e) => setFilterSchool(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-sm sm:text-base text-gray-900 bg-white"
            >
              <option value="">-- Semua Sekolah --</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>

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

          {/* Filter Semester */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Semester
            </label>
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              disabled={!filterSchoolYear}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-sm sm:text-base text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              <option value="">
                {filterSchoolYear ? '-- Semua Semester --' : '-- Pilih Tahun Ajaran Terlebih Dahulu --'}
              </option>
              {semesters.map((sem) => (
                <option key={sem.id} value={sem.id}>
                  Semester {sem.number}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Reset Button */}
        {(filterSchool || filterSchoolYear || filterLevel || filterClass || filterSemester) && (
          <div className="pt-2">
            <button
              onClick={() => {
                setFilterSchool('');
                setFilterSchoolYear('');
                setFilterLevel('');
                setFilterClass('');
                setFilterSemester('');
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

      {/* Nilai Siswa Per Kelas Section */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Nilai Siswa Per Kelas</h2>
        
        {isLoadingGrades ? (
          <div className="py-10 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-600 text-sm">Memuat data nilai...</p>
          </div>
        ) : gradesPerClass.length === 0 ? (
          <div className="py-10 text-center text-gray-500">
            <p>Tidak ada data nilai untuk filter yang dipilih</p>
          </div>
        ) : (
          <div className="space-y-4">
            {gradesPerClass.map((classData) => (
              <div key={classData.classId} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleStudentClassExpand(classData.classId)}
                  className="w-full px-4 py-4 hover:bg-gray-50 flex items-center justify-between transition-colors"
                >
                  <div className="flex-1 text-left">
                    <h3 className="text-base font-semibold text-gray-900">{classData.className}</h3>
                    <p className="text-xs text-gray-500">{classData.levelName} • {classData.totalStudents} Siswa</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">{classData.averageScore.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">Rata-rata Nilai</p>
                    </div>
                    {expandedStudentClasses.has(classData.classId) ? (
                      <ChevronUp className="text-gray-600" size={20} />
                    ) : (
                      <ChevronDown className="text-gray-600" size={20} />
                    )}
                  </div>
                </button>

                {/* Student List - Collapsible */}
                {expandedStudentClasses.has(classData.classId) && (
                  <div className="border-t border-gray-200 px-4 py-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="px-3 py-2 text-left font-medium text-gray-700">No</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Nama Siswa</th>
                            <th className="px-3 py-2 text-center font-medium text-gray-700">No. Siswa</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-700">Nilai</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classData.students.map((student, idx) => (
                            <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-600">{idx + 1}</td>
                              <td className="px-3 py-2 text-gray-900 font-medium">{student.name}</td>
                              <td className="px-3 py-2 text-center text-gray-600">{student.studentNo}</td>
                              <td className="px-3 py-2 text-right">
                                <span className={`inline-block px-2 py-1 rounded font-semibold text-xs ${
                                  student.averageScore >= 80 ? 'bg-green-100 text-green-700' :
                                  student.averageScore >= 70 ? 'bg-blue-100 text-blue-700' :
                                  student.averageScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {student.averageScore.toFixed(2)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nilai Rata-rata Mata Pelajaran Per Kelas Section */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Nilai Rata-rata Mata Pelajaran Per Kelas</h2>
        
        {isLoadingSubjectGrades ? (
          <div className="py-10 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-600 text-sm">Memuat data nilai mata pelajaran...</p>
          </div>
        ) : gradesPerSubject.length === 0 ? (
          <div className="py-10 text-center text-gray-500">
            <p>Tidak ada data nilai mata pelajaran untuk filter yang dipilih</p>
          </div>
        ) : (
          <div className="space-y-4">
            {gradesPerSubject.map((classData) => (
              <div key={classData.classId} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSubjectClassExpand(classData.classId)}
                  className="w-full px-4 py-4 hover:bg-gray-50 flex items-center justify-between transition-colors"
                >
                  <div className="flex-1 text-left">
                    <h3 className="text-base font-semibold text-gray-900">{classData.className}</h3>
                    <p className="text-xs text-gray-500">{classData.levelName}</p>
                  </div>
                  {expandedSubjectClasses.has(classData.classId) ? (
                    <ChevronUp className="text-gray-600" size={20} />
                  ) : (
                    <ChevronDown className="text-gray-600" size={20} />
                  )}
                </button>

                {/* Subject Grades Table - Collapsible */}
                {expandedSubjectClasses.has(classData.classId) && (
                  <div className="border-t border-gray-200 px-4 py-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Mata Pelajaran</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-700">Nilai Rata-rata</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classData.subjects.map((subject, idx) => (
                            <tr key={subject.subjectId} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-900 font-medium">{subject.subjectName}</td>
                              <td className="px-3 py-2 text-right">
                                <span className={`inline-block px-3 py-1 rounded font-semibold text-xs ${
                                  subject.averageScore >= 80 ? 'bg-green-100 text-green-700' :
                                  subject.averageScore >= 70 ? 'bg-blue-100 text-blue-700' :
                                  subject.averageScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {subject.averageScore.toFixed(2)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
