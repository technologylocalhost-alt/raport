'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, FileText } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { clearAuthData } from '@/lib/auth/client';
import { devError } from '@/lib/dev-log';

interface School {
  id: string;
  name: string;
}

interface Level {
  id: string;
  name: string;
  schoolId: string;
}

interface SchoolYear {
  id: string;
  year: string;
  schoolId: string;
  isActive?: boolean;
}

interface Semester {
  id: string;
  number: number;
  schoolYearId: string;
  isActive?: boolean;
}

interface RaportData {
  id: string;
  studentId: string;
  studentName: string;
  studentNo: string;
  className: string;
  subjectName: string;
  competencyName: string;
  teacherName: string;
  score: string;
  scoringType: string;
  assessmentType: string;
  nomorRaport?: string;
  suluk?: string;
  muazobah?: string;
  nazofah?: string;
  createdAt: string;
  updatedAt: string;
}

interface StudentRowData {
  studentId: string;
  studentNo: string;
  studentName: string;
  className: string;
  status: 'Menunggu' | 'Disetujui' | 'Ditolak';
  [key: string]: string; // For subject-assessment type columns
}

interface PaginatedResponse {
  success: boolean;
  data: RaportData[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface ClassResponseItem {
  id: string;
  name: string;
  levelId?: string;
  schoolYearId?: string;
  level?: {
    schoolId?: string;
  };
  schoolYear?: {
    schoolId?: string;
  };
}

interface ClassSubjectResponseItem {
  subject?: { id: string; name: string; code?: string };
  id?: string;
  name?: string;
  code?: string;
}

interface StudentResponseItem {
  id: string;
  name: string;
  studentNo: string;
}

interface ClassSubjectsResponse {
  data?: ClassSubjectResponseItem[];
}

interface ClassStudentsResponse {
  data?: StudentResponseItem[];
}

export default function RaportsPage() {
  const router = useRouter();
  const [raports, setRaports] = useState<RaportData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterSchool, setFilterSchool] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [selectedClassName, setSelectedClassName] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStudent, setFilterStudent] = useState('');
  const [filterAssessmentType, setFilterAssessmentType] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string; levelId?: string; schoolYearId?: string; schoolId?: string; levelSchoolId?: string }>>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [students, setStudents] = useState<Array<{ id: string; name: string; no: string }>>([]);
  const [isClient, setIsClient] = useState(false);
  const [filterSchoolYear, setFilterSchoolYear] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [pivotData, setPivotData] = useState<StudentRowData[]>([]);
  const [pivotColumns, setPivotColumns] = useState<string[]>([]);

  const limit = 1000; // No pagination in pivot view

  const transformToPivotTable = useCallback(() => {
    const pivotMap: { [key: string]: StudentRowData } = {};
    const columnsSet = new Set<string>();

    // First pass: create all students as rows
    raports.forEach(raport => {
      const key = raport.studentId;
      if (!pivotMap[key]) {
        pivotMap[key] = {
          studentId: raport.studentId,
          studentNo: raport.studentNo,
          studentName: raport.studentName,
          className: raport.className,
          status: 'Menunggu',
        };
      }
    });

    // Second pass: add grades and collect columns
    raports.forEach(raport => {
      const key = raport.studentId;
      const columnKey = `${raport.subjectName} - ${raport.assessmentType}`;
      columnsSet.add(columnKey);
      pivotMap[key][columnKey] = raport.score;
    });

    // Sort columns
    const sortedColumns = Array.from(columnsSet).sort();

    // Fill empty cells
    Object.keys(pivotMap).forEach(studentId => {
      sortedColumns.forEach(col => {
        if (!pivotMap[studentId][col]) {
          pivotMap[studentId][col] = '—';
        }
      });
    });

    const result = Object.values(pivotMap).sort((a, b) => 
      a.studentNo.localeCompare(b.studentNo)
    );

    setPivotData(result);
    setPivotColumns(sortedColumns);
  }, [raports]);

  // Ensure we're on client side before accessing localStorage
  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchClasses = useCallback(async () => {
    try {
      const yearsParams = new URLSearchParams({ limit: '100' });
      if (filterSchool) {
        yearsParams.set('schoolId', filterSchool);
      }

      const yearsResponse = await apiFetch(`/api/admin/school-years?${yearsParams.toString()}`);
      const yearsData = await yearsResponse.json();
      const schoolYearsData = yearsData.data || [];
      if (filterSchool && schoolYearsData.length === 0) {
        const fallbackResponse = await apiFetch('/api/admin/school-years?limit=100');
        const fallbackData = await fallbackResponse.json();
        setSchoolYears(fallbackData.data || []);
      } else {
        setSchoolYears(schoolYearsData);
      }

      if (filterSchoolYear) {
        const schoolYearResponse = await apiFetch(`/api/admin/school-years/${filterSchoolYear}`);
        const schoolYearData = await schoolYearResponse.json();
        setSemesters(schoolYearData.data?.semesters || []);
      } else {
        setSemesters([]);
      }

      const schoolsResponse = await apiFetch('/api/admin/schools?limit=1000');
      const schoolsData = await schoolsResponse.json();
      setSchools(schoolsData.data || []);

      const levelsResponse = await apiFetch('/api/admin/levels?limit=1000');
      const levelsData = await levelsResponse.json();
      setLevels(levelsData.data || []);

      const classParams = new URLSearchParams({ limit: '1000' });
      if (filterSchoolYear) classParams.set('schoolYearId', filterSchoolYear);
      if (filterSemester) classParams.set('semesterId', filterSemester);
      if (filterSchool) classParams.set('schoolId', filterSchool);
      const response = await apiFetch(`/api/admin/classes?${classParams.toString()}`);

      if (response.status === 401) {
        clearAuthData();
        router.push('/login');
        return;
      }

      if (!response.ok) {
        devError('Failed to fetch classes:', response.statusText as unknown);
        return;
      }

      const data: { success: boolean; data?: ClassResponseItem[] } = await response.json();
      if (data.success && data.data) {
        setClasses(data.data.map((c) => ({
          id: c.id,
          name: c.name,
          levelId: c.levelId,
          schoolYearId: c.schoolYearId,
          levelSchoolId: c.level?.schoolId,
          schoolId: c.schoolYear?.schoolId,
        })));
      }
    } catch (error) {
      devError('Failed to fetch classes:', error);
    }
  }, [filterSchool, filterSchoolYear, filterSemester, router]);

  const fetchSubjectsAndStudents = useCallback(async () => {
    try {
      const subjectsResponse = await apiFetch(`/api/admin/classes/${filterClass}/subjects`);
      const studentsResponse = await apiFetch(`/api/admin/classes/${filterClass}/students?limit=1000`);

      if (subjectsResponse.status === 401 || studentsResponse.status === 401) {
        clearAuthData();
        router.push('/login');
        return;
      }

      if (!subjectsResponse.ok) {
        devError('Failed to fetch subjects:', subjectsResponse.statusText as unknown);
        setSubjects([]);
      } else {
        const subjectsData: ClassSubjectsResponse = await subjectsResponse.json();
        const subjectsArray = subjectsData.data || [];
        setSubjects(subjectsArray.map((item: ClassSubjectResponseItem) => ({
          id: item.subject?.id || item.id || '',
          name: item.subject?.name || item.name || '',
          code: item.subject?.code || '',
        })));
      }

      if (!studentsResponse.ok) {
        devError('Failed to fetch students:', studentsResponse.statusText as unknown);
        setStudents([]);
      } else {
        const studentsData: ClassStudentsResponse = await studentsResponse.json();
        const studentsArray = studentsData.data || [];
        setStudents(studentsArray.map((s: StudentResponseItem) => ({
          id: s.id,
          name: s.name,
          no: s.studentNo,
        })));
      }
    } catch (error) {
      devError('Failed to fetch subjects and students:', error);
    }
  }, [filterClass, router]);

  const fetchRaports = useCallback(async () => {
    if (!filterClass || !selectedClassName) return;

    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        classId: filterClass,
        ...(search && { search }),
        ...(filterSubject && { subject: filterSubject }),
        ...(filterStudent && { student: filterStudent }),
        ...(filterAssessmentType && { assessmentType: filterAssessmentType }),
      });
      const response = await apiFetch(`/api/admin/raports?${queryParams}`);

      if (response.status === 401) {
        clearAuthData();
        router.push('/login');
        return;
      }

      if (!response.ok) {
        devError('Failed to fetch raports:', response.statusText as unknown);
        return;
      }

      const data: PaginatedResponse = await response.json();
      setRaports(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      devError('Failed to fetch raports:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filterAssessmentType, filterClass, filterStudent, filterSubject, page, router, search, selectedClassName]);

  useEffect(() => {
    if (isClient) {
      void fetchClasses();
    }
  }, [fetchClasses, isClient]);

  useEffect(() => {
    if (filterClass) {
      void fetchSubjectsAndStudents();
      setPage(1);
      void fetchRaports();
    }
  }, [fetchRaports, fetchSubjectsAndStudents, filterClass]);

  useEffect(() => {
    if (!filterSchoolYear) {
      setSemesters([]);
    }
    if (!filterSchoolYear) {
      setFilterSemester('');
    }
  }, [filterSchoolYear, fetchClasses]);

  useEffect(() => {
    if (raports.length > 0) {
      transformToPivotTable();
    }
  }, [raports.length, transformToPivotTable]);

  const getSchoolIdForClass = (classId: string): string | undefined => {
    const classObj = classes.find(c => c.id === classId);
    if (classObj?.levelSchoolId) return classObj.levelSchoolId;
    if (classObj?.schoolId) return classObj.schoolId;
    if (classObj?.schoolYearId) {
      const year = schoolYears.find((item) => item.id === classObj.schoolYearId);
      if (year?.schoolId) return year.schoolId;
    }
    if (!classObj?.levelId) return undefined;
    const level = levels.find(l => l.id === classObj.levelId);
    return level?.schoolId;
  };


  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manajemen Raport</h1>
          <p className="text-gray-600 mt-2 text-sm sm:text-base">
            Total: {total} raport yang sudah di-input
          </p>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} className="text-emerald-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filter Data</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Sekolah */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Sekolah
            </label>
            <select
              value={filterSchool}
              onChange={(e) => {
                setFilterSchool(e.target.value);
                setFilterSchoolYear('');
                setFilterSemester('');
                setFilterClass('');
                setSelectedClassName('');
                setFilterSubject('');
                setFilterStudent('');
                setFilterAssessmentType('');
                setSearch('');
                setPage(1);
              }}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-gray-900 bg-white"
            >
              <option value="">-- Semua Sekolah --</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tahun Ajaran */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Tahun Ajaran
            </label>
            <select
              value={filterSchoolYear}
              onChange={(e) => {
                setFilterSchoolYear(e.target.value);
                setFilterSemester('');
                setFilterClass('');
                setSelectedClassName('');
                setFilterSubject('');
                setFilterStudent('');
                setFilterAssessmentType('');
                setSearch('');
                setPage(1);
                if (isClient) fetchClasses();
              }}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-gray-900 bg-white"
            >
              <option value="">-- Semua Tahun --</option>
              {schoolYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.year} {year.isActive ? '(Aktif)' : '(Nonaktif)'}
                </option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Semester
            </label>
            <select
              value={filterSemester}
              onChange={(e) => {
                setFilterSemester(e.target.value);
                setFilterClass('');
                setSelectedClassName('');
                setFilterSubject('');
                setFilterStudent('');
                setFilterAssessmentType('');
                setSearch('');
                setPage(1);
                if (isClient) fetchClasses();
              }}
              disabled={!filterSchoolYear}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-gray-900 bg-white disabled:bg-gray-100"
            >
              <option value="">-- Semua Semester --</option>
              {semesters.map((semester) => (
                <option key={semester.id} value={semester.id}>
                  Semester {semester.number} {semester.isActive ? '(Aktif)' : '(Nonaktif)'}
                </option>
              ))}
            </select>
          </div>

          {/* Kelas */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Kelas
            </label>
            <select
              value={filterClass}
              onChange={(e) => {
                const selectedId = e.target.value;
                const selectedClass = classes.find(c => c.id === selectedId);
                setFilterClass(selectedId);
                setSelectedClassName(selectedClass?.name || '');
                setFilterSubject('');
                setFilterStudent('');
                setFilterAssessmentType('');
                setSearch('');
                setPage(1);
              }}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-gray-900 bg-white"
            >
              <option value="">-- Semua Kelas --</option>
              {classes.filter(c => !filterSchool || getSchoolIdForClass(c.id) === filterSchool).map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          {/* Mata Pelajaran */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Mata Pelajaran
            </label>
            <select
              value={filterSubject}
              onChange={(e) => {
                setFilterSubject(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-gray-900 bg-white"
            >
              <option value="">-- Semua --</option>
              {subjects.map((subj) => (
                <option key={subj.id} value={subj.name}>
                  {subj.name}
                </option>
              ))}
            </select>
          </div>

          {/* Siswa */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Siswa
            </label>
            <select
              value={filterStudent}
              onChange={(e) => {
                setFilterStudent(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-gray-900 bg-white"
            >
              <option value="">-- Semua --</option>
              {students.map((std) => (
                <option key={std.id} value={std.name}>
                  {std.name} ({std.no})
                </option>
              ))}
            </select>
          </div>

          {/* Jenis Penilaian */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Jenis Penilaian
            </label>
            <select
              value={filterAssessmentType}
              onChange={(e) => {
                setFilterAssessmentType(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-gray-900 bg-white"
            >
              <option value="">-- Semua --</option>
              <option value="UTS_1">UTS 1</option>
              <option value="UAS_1">UAS 1</option>
              <option value="UTS_2">UTS 2</option>
              <option value="UAS_2">UAS 2</option>
              <option value="FINAL_EXAM_1">Ujian Akhir Gel 1</option>
              <option value="FINAL_EXAM_2">Ujian Akhir Gel 2</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Pencarian
            </label>
            <input
              type="text"
              placeholder="Guru, kompetensi..."
              value={search}
              onChange={handleSearch}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium placeholder-gray-500 bg-white text-gray-900"
            />
          </div>
        </div>
      </div>

      {/* Summary Statistics Cards */}
      {filterClass && raports.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Data Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-emerald-600">
            <p className="text-gray-600 text-sm font-medium">Total Data</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{total}</p>
          </div>

          {/* Mata Pelajaran Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <p className="text-gray-600 text-sm font-medium">Mata Pelajaran</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{new Set(raports.map(r => r.subjectName)).size}</p>
          </div>

          {/* Siswa Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
            <p className="text-gray-600 text-sm font-medium">Siswa</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{new Set(raports.map(r => r.studentName)).size}</p>
          </div>

          {/* Jenis Penilaian Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
            <p className="text-gray-600 text-sm font-medium">Jenis Penilaian</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{new Set(raports.map(r => r.assessmentType)).size}</p>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {!filterClass ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <FileText size={64} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg font-medium">Silakan pilih kelas terlebih dahulu</p>
              <p className="text-gray-500 text-sm mt-2">Gunakan filter di atas untuk memulai</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Memuat data raport...</p>
            </div>
          </div>
        ) : raports.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <FileText size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Tidak ada data raport ditemukan untuk kelas <span className="font-semibold">{selectedClassName}</span></p>
            </div>
          </div>
        ) : (
          <>
            {/* Table Header with Class Name */}
            <div className="bg-gray-100 px-6 py-3 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-900">Data Penilaian Kelas <span className="font-bold text-emerald-600">{selectedClassName}</span></p>
              <p className="text-xs text-gray-600 mt-1">Total Siswa: {pivotData.length} | Total Data Nilai: {raports.length}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider bg-gray-50 border-r border-gray-200">NO</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider bg-gray-50 border-r border-gray-200">STAMBUK</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider bg-gray-50 border-r border-gray-200 min-w-[150px]">NAMA</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider bg-gray-50 border-r border-gray-200">KELAS</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-900 uppercase tracking-wider bg-gray-50 border-r border-gray-200">STATUS</th>
                    {pivotColumns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-center text-xs font-bold text-gray-900 uppercase tracking-wider bg-gray-50 border-r border-gray-200 min-w-[100px] whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {pivotData.map((row, index) => (
                    <tr key={row.studentId} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-200">{index + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-200">{row.studentNo}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-200 min-w-[150px]">{row.studentName}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">{row.className}</td>
                      <td className="px-4 py-3 text-center border-r border-gray-200">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                          {row.status}
                        </span>
                      </td>
                      {pivotColumns.map((col) => {
                        const value = row[col] || '—';
                        const isNumber = value !== '—' && !isNaN(parseFloat(value));
                        return (
                          <td
                            key={`${row.studentId}-${col}`}
                            className="px-4 py-3 text-center text-sm border-r border-gray-200"
                          >
                            {isNumber ? (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-900">
                                {value}
                              </span>
                            ) : (
                              <span className="text-gray-400">{value}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
