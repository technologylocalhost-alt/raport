'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, ChevronDown, ChevronUp, School } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { getCurrentUser } from '@/lib/auth/client';
import { devError } from '@/lib/dev-log';

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

interface StudentRanking {
  studentId: string;
  studentName: string;
  studentNo: string;
  className: string;
  levelName: string;
  averageScore: number;
}

interface StatsSummary {
  totalUsers: number;
  totalStudents: number;
  totalSubjects: number;
  totalClasses: number;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [, setStats] = useState<StatsSummary>({
    totalUsers: 0,
    totalStudents: 0,
    totalSubjects: 0,
    totalClasses: 0,
  });
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

  const [schoolRankings, setSchoolRankings] = useState<StudentRanking[]>([]);
  const [isLoadingRankings, setIsLoadingRankings] = useState(false);

  const [isNilaiSiswaExpanded, setIsNilaiSiswaExpanded] = useState(false);
  const [isMataAjaranExpanded, setIsMataAjaranExpanded] = useState(false);
  const [isRankingExpanded, setIsRankingExpanded] = useState(false);

  const [rankingCurrentPage, setRankingCurrentPage] = useState(1);
  const rankingItemsPerPage = 50;

  const fetchFilterOptions = useCallback(async () => {
    try {
      const [schoolsRes, yearsRes, levelsRes, classesRes] = await Promise.all([
        apiFetch('/api/admin/schools?limit=1000'),
        apiFetch('/api/admin/school-years?limit=100'),
        apiFetch('/api/admin/levels?limit=100'),
        apiFetch('/api/admin/classes?limit=100'),
      ]);

      const schoolsData = await schoolsRes.json();
      const yearsData = await yearsRes.json();
      const levelsData = await levelsRes.json();
      const classesData = await classesRes.json();

      setSchools(schoolsData.data || []);
      setSchoolYears(yearsData.data || []);
      setLevels(levelsData.data || []);
      setClasses(classesData.data || []);
    } catch (error) {
      devError('Error fetching filter options:', error);
    }
  }, []);

  const fetchSemestersBySchoolYear = useCallback(async (schoolYearId: string) => {
    try {
      const semestersRes = await apiFetch(
        `/api/admin/semesters?limit=100&schoolYearId=${schoolYearId}`
      );

      const semestersData = await semestersRes.json();
      setSemesters(semestersData.data || []);
    } catch (error) {
      devError('Error fetching semesters:', error);
      setSemesters([]);
    }
  }, []);

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

  const fetchGradesPerSubject = useCallback(async () => {
    try {
      setIsLoadingSubjectGrades(true);

      const params = new URLSearchParams();
      params.append('limit', '1000');
      if (filterSchool) params.append('schoolId', filterSchool);
      if (filterSchoolYear) params.append('schoolYearId', filterSchoolYear);
      if (filterLevel) params.append('levelId', filterLevel);
      if (filterSemester) params.append('semesterId', filterSemester);

      const res = await apiFetch(`/api/admin/grades/per-subject?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setGradesPerSubject(data.data || []);
      }
    } catch (error) {
      devError('Error fetching grades per subject:', error);
    } finally {
      setIsLoadingSubjectGrades(false);
    }
  }, [filterLevel, filterSchool, filterSchoolYear, filterSemester]);

  const fetchGradesPerClass = useCallback(async () => {
    try {
      setIsLoadingGrades(true);

      const params = new URLSearchParams();
      params.append('limit', '1000');
      if (filterSchool) params.append('schoolId', filterSchool);
      if (filterSchoolYear) params.append('schoolYearId', filterSchoolYear);
      if (filterLevel) params.append('levelId', filterLevel);
      if (filterSemester) params.append('semesterId', filterSemester);

      const res = await apiFetch(`/api/admin/grades/per-class?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setGradesPerClass(data.data || []);
      }
    } catch (error) {
      devError('Error fetching grades per class:', error);
    } finally {
      setIsLoadingGrades(false);
    }
  }, [filterLevel, filterSchool, filterSchoolYear, filterSemester]);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);

      const params = new URLSearchParams();
      params.append('limit', '1000');
      if (filterSchool) params.append('schoolId', filterSchool);
      if (filterSchoolYear) params.append('schoolYearId', filterSchoolYear);
      if (filterLevel) params.append('levelId', filterLevel);
      if (filterClass) params.append('classId', filterClass);
      if (filterSemester) params.append('semesterId', filterSemester);

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
    } finally {
      setIsLoading(false);
    }
  }, [filterClass, filterLevel, filterSchool, filterSchoolYear, filterSemester]);

  const fetchSchoolRankings = useCallback(async () => {
    try {
      setIsLoadingRankings(true);

      const params = new URLSearchParams();
      params.append('limit', '10000');
      if (filterSchoolYear) params.append('schoolYearId', filterSchoolYear);
      if (filterLevel) params.append('levelId', filterLevel);
      if (filterSemester) params.append('semesterId', filterSemester);

      const res = await apiFetch(`/api/admin/grades/per-class?${params}`);
      const data = await res.json();

      if (data.success && data.data) {
        const allStudents: StudentRanking[] = [];

        data.data.forEach((classData: GradePerClass) => {
          classData.students.forEach((student) => {
            allStudents.push({
              studentId: student.id,
              studentName: student.name,
              studentNo: student.studentNo,
              className: classData.className,
              levelName: classData.levelName,
              averageScore: student.averageScore,
            });
          });
        });

        const rankings = allStudents.sort((a, b) => b.averageScore - a.averageScore);

        setSchoolRankings(rankings);
        setRankingCurrentPage(1);
      }
    } catch (error) {
      devError('Error fetching school rankings:', error);
    } finally {
      setIsLoadingRankings(false);
    }
  }, [filterLevel, filterSchoolYear, filterSemester]);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.push('/login');
      return;
    }

    void fetchFilterOptions();
    void fetchStats();
    void fetchGradesPerClass();
    void fetchGradesPerSubject();
    void fetchSchoolRankings();
  }, [router, fetchFilterOptions, fetchGradesPerClass, fetchGradesPerSubject, fetchSchoolRankings, fetchStats]);

  useEffect(() => {
    if (filterSchoolYear) {
      void fetchSemestersBySchoolYear(filterSchoolYear);
      setFilterSemester('');
    } else {
      setSemesters([]);
      setFilterSemester('');
    }
  }, [fetchSemestersBySchoolYear, filterSchoolYear]);

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



      {/* Nilai Siswa Per Kelas Section */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <button
          onClick={() => setIsNilaiSiswaExpanded(!isNilaiSiswaExpanded)}
          className="w-full px-4 sm:p-6 py-4 hover:bg-gray-50 flex items-center justify-between transition-colors"
        >
          <h2 className="text-lg font-semibold text-gray-900">Nilai Siswa Per Kelas</h2>
          {isNilaiSiswaExpanded ? (
            <ChevronUp size={24} className="text-blue-600" />
          ) : (
            <ChevronDown size={24} className="text-blue-600" />
          )}
        </button>

        {isNilaiSiswaExpanded && (
          <div className="border-t border-gray-200 p-4 sm:p-6">
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
        )}
      </div>

      {/* Nilai Rata-rata Mata Pelajaran Per Kelas Section */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <button
          onClick={() => setIsMataAjaranExpanded(!isMataAjaranExpanded)}
          className="w-full px-4 sm:p-6 py-4 hover:bg-gray-50 flex items-center justify-between transition-colors"
        >
          <h2 className="text-lg font-semibold text-gray-900">Nilai Rata-rata Mata Pelajaran Per Kelas</h2>
          {isMataAjaranExpanded ? (
            <ChevronUp size={24} className="text-blue-600" />
          ) : (
            <ChevronDown size={24} className="text-blue-600" />
          )}
        </button>

        {isMataAjaranExpanded && (
          <div className="border-t border-gray-200 p-4 sm:p-6">
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
                          {classData.subjects.map((subject) => (
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
        )}
      </div>

      {/* Rekapan Ranking Siswa Berdasarkan Sekolah Section */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <button
          onClick={() => setIsRankingExpanded(!isRankingExpanded)}
          className="w-full px-4 sm:p-6 py-4 hover:bg-gray-50 flex items-center justify-between transition-colors"
        >
          <h2 className="text-lg font-semibold text-gray-900">Rekapan Ranking Siswa (Semua Siswa)</h2>
          {isRankingExpanded ? (
            <ChevronUp size={24} className="text-blue-600" />
          ) : (
            <ChevronDown size={24} className="text-blue-600" />
          )}
        </button>

        {isRankingExpanded && (
          <div className="border-t border-gray-200 p-4 sm:p-6">
        
        {isLoadingRankings ? (
          <div className="py-10 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-600 text-sm">Memuat data ranking...</p>
          </div>
        ) : schoolRankings.length === 0 ? (
          <div className="py-10 text-center text-gray-500">
            <p>Tidak ada data ranking untuk filter yang dipilih</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm border border-gray-300">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="px-3 py-3 text-center font-bold text-gray-800 border-r border-gray-300">NO</th>
                  <th className="px-3 py-3 text-center font-bold text-gray-800 border-r border-gray-300">RANKING</th>
                  <th className="px-3 py-3 text-center font-bold text-gray-800 border-r border-gray-300">NO. SISWA</th>
                  <th className="px-3 py-3 text-left font-bold text-gray-800 border-r border-gray-300">NAMA SISWA</th>
                  <th className="px-3 py-3 text-center font-bold text-gray-800 border-r border-gray-300">KELAS</th>
                  <th className="px-3 py-3 text-center font-bold text-gray-800 border-r border-gray-300">JENJANG</th>
                  <th className="px-3 py-3 text-center font-bold text-white bg-green-600 border-r border-gray-300">RATA-RATA</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const startIdx = (rankingCurrentPage - 1) * rankingItemsPerPage;
                  const endIdx = startIdx + rankingItemsPerPage;
                  const paginatedRankings = schoolRankings.slice(startIdx, endIdx);
                  
                  return paginatedRankings.map((ranking, idx) => {
                    const globalIdx = startIdx + idx;
                    const rankingLabel = globalIdx < 10 ? `RANKING ${(globalIdx + 1).toString().padStart(2, '0')}` : `RANKING ${globalIdx + 1}`;
                    const medalColor = 
                      globalIdx === 0 ? 'bg-yellow-300 text-gray-900' :
                      globalIdx === 1 ? 'bg-gray-300 text-gray-900' :
                      globalIdx === 2 ? 'bg-orange-300 text-gray-900' :
                      'bg-blue-100 text-gray-900';
                    
                    return (
                      <tr key={ranking.studentId} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-3 py-2 text-center font-bold text-gray-800 border-r border-gray-300">{globalIdx + 1}</td>
                        <td className="px-3 py-2 text-center font-semibold text-gray-800 border-r border-gray-300">
                          <span className={`inline-block px-2 py-1 rounded ${medalColor} font-bold`}>
                            {rankingLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-gray-700 border-r border-gray-300 font-semibold">{ranking.studentNo}</td>
                        <td className="px-3 py-2 text-gray-900 font-medium border-r border-gray-300">{ranking.studentName}</td>
                        <td className="px-3 py-2 text-center text-gray-700 border-r border-gray-300 font-semibold">{ranking.className}</td>
                        <td className="px-3 py-2 text-center text-gray-700 border-r border-gray-300 font-semibold">{ranking.levelName}</td>
                        <td className={`px-3 py-2 text-center font-bold text-lg ${
                          ranking.averageScore >= 85 ? 'bg-green-500 text-white' :
                          ranking.averageScore >= 75 ? 'bg-green-400 text-white' :
                          ranking.averageScore >= 65 ? 'bg-yellow-400 text-white' :
                          'bg-red-400 text-white'
                        }`}>
                          {ranking.averageScore.toFixed(2)}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            {schoolRankings.length > rankingItemsPerPage && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <p>Menampilkan {((rankingCurrentPage - 1) * rankingItemsPerPage) + 1}-{Math.min(rankingCurrentPage * rankingItemsPerPage, schoolRankings.length)} dari {schoolRankings.length} siswa</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRankingCurrentPage(Math.max(1, rankingCurrentPage - 1))}
                    disabled={rankingCurrentPage === 1}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sebelumnya
                  </button>
                  
                  <div className="flex gap-1 items-center px-2">
                    {(() => {
                      const totalPages = Math.ceil(schoolRankings.length / rankingItemsPerPage);
                      const pages = [];
                      for (let i = Math.max(1, rankingCurrentPage - 2); i <= Math.min(totalPages, rankingCurrentPage + 2); i++) {
                        pages.push(i);
                      }
                      return pages.map((page) => (
                        <button
                          key={page}
                          onClick={() => setRankingCurrentPage(page)}
                          className={`px-2 py-1 text-sm rounded ${
                            rankingCurrentPage === page
                              ? 'bg-blue-600 text-white font-bold'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {page}
                        </button>
                      ));
                    })()}
                  </div>

                  <button
                    onClick={() => setRankingCurrentPage(rankingCurrentPage + 1)}
                    disabled={rankingCurrentPage >= Math.ceil(schoolRankings.length / rankingItemsPerPage)}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
            </div>
        )}
      </div>
    </div>
  );
}
