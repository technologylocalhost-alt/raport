'use client';

import { useCallback, useEffect, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, AlertCircle, Filter, Users, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
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
  isActive?: boolean;
}

interface ClassItem {
  id: string;
  name: string;
  levelName?: string;
  levelId?: string;
}

interface Student {
  id: string;
  name: string;
  studentNo: string;
  nourut?: number;
  classId: string;
  className: string;
}

interface ClassResponseItem {
  id: string;
  name: string;
  levelId?: string;
  level?: { name?: string; id?: string };
}

interface StudentResponseItem {
  id: string;
  name: string;
  studentNo: string;
  nourut?: number;
}

export default function AdminRaportPage() {
  const router = useRouter();

  const [schools, setSchools] = useState<School[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedClassName, setSelectedClassName] = useState('');
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterAssessmentType, setFilterAssessmentType] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

  const fetchClasses = useCallback(async () => {
    try {
      setIsLoadingClasses(true);

      const yearsResponse = await apiFetch('/api/admin/school-years?limit=100');
      const yearsData = await yearsResponse.json();
      setSchoolYears(yearsData.data || []);

      const schoolsResponse = await apiFetch('/api/admin/schools?limit=1000');
      const schoolsData = await schoolsResponse.json();
      setSchools(schoolsData.data || []);

      const levelsResponse = await apiFetch('/api/admin/levels?limit=1000');
      const levelsData = await levelsResponse.json();
      setLevels(levelsData.data || []);

      const response = await apiFetch(`/api/admin/classes?limit=1000${selectedSchoolYear ? `&schoolYearId=${selectedSchoolYear}` : ''}`);

      if (response.status === 401) {
        clearAuthData();
        router.push('/login');
        return;
      }

      const data = await response.json();
      if (data.success && data.data) {
        setClasses(
          (data.data as ClassResponseItem[]).map((c) => ({
            id: c.id,
            name: c.name,
            levelName: c.level?.name || '',
            levelId: c.levelId || c.level?.id || '',
          }))
        );
      }
    } catch (error) {
      devError('Error fetching classes:', error);
      setError('Gagal memuat daftar kelas');
    } finally {
      setIsLoadingClasses(false);
    }
  }, [router, selectedSchoolYear]);

  const fetchStudents = useCallback(async (classId: string, page: number) => {
    try {
      setIsLoadingStudents(true);
      setError('');

      const response = await apiFetch(
        `/api/admin/classes/${classId}/students?page=${page}&limit=${itemsPerPage}`
      );

      if (response.status === 401) {
        clearAuthData();
        router.push('/login');
        return;
      }

      const data = await response.json();
      if (data.success && data.data) {
        const cls = classes.find((c) => c.id === classId);
        setStudents(
          (data.data as StudentResponseItem[]).map((s) => ({
            id: s.id,
            name: s.name,
            studentNo: s.studentNo,
            nourut: s.nourut,
            classId: classId,
            className: cls?.name || '',
          }))
        );
        const total = data.pagination?.total || data.data.length;
        setTotalStudents(total);
        setTotalPages(Math.ceil(total / itemsPerPage));
      } else {
        setStudents([]);
        setTotalStudents(0);
        setTotalPages(1);
      }
    } catch (error) {
      devError('Error fetching students:', error);
      setError('Gagal memuat daftar siswa');
    } finally {
      setIsLoadingStudents(false);
    }
  }, [classes, itemsPerPage, router]);

  useEffect(() => {
    void fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    if (selectedClassId) {
      setCurrentPage(1);
      void fetchStudents(selectedClassId, 1);
    } else {
      setStudents([]);
      setTotalStudents(0);
      setTotalPages(1);
    }
  }, [fetchStudents, selectedClassId]);

  useEffect(() => {
    if (selectedClassId) {
      void fetchStudents(selectedClassId, currentPage);
    }
  }, [currentPage, fetchStudents, selectedClassId]);

  const getSchoolIdForClass = (classId: string): string | undefined => {
    const classObj = classes.find(c => c.id === classId);
    if (!classObj?.levelId) return undefined;
    const level = levels.find(l => l.id === classObj.levelId);
    return level?.schoolId;
  };


  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.studentNo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Raport Siswa</h1>
        <p className="text-gray-600 mt-1 text-sm">
          Pilih kelas untuk melihat dan mencetak raport siswa
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Filter size={18} className="text-emerald-600" />
          <h2 className="text-base font-semibold text-gray-900">Filter</h2>
        </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Sekolah */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Sekolah</label>
            <select
              value={selectedSchool}
              onChange={(e) => {
                setSelectedSchool(e.target.value);
                setSelectedSchoolYear('');
                setSelectedClassId('');
                setSelectedClassName('');
                setSearch('');
                setFilterAssessmentType('');
              }}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white font-medium"
            >
              <option value="">-- Semua --</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tahun Ajaran */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tahun Ajaran</label>
            <select
              value={selectedSchoolYear}
              onChange={(e) => {
                setSelectedSchoolYear(e.target.value);
                setSelectedClassId('');
                setSelectedClassName('');
                setSearch('');
                setFilterAssessmentType('');
              }}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white font-medium"
            >
              <option value="">-- Semua --</option>
              {schoolYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.year} {year.isActive ? '(Aktif)' : '(Nonaktif)'}
                </option>
              ))}
            </select>
          </div>

          {/* Pilih Kelas */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Kelas</label>
            {isLoadingClasses ? (
              <div className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-400 text-sm">
                Memuat kelas...
              </div>
            ) : (
              <select
                value={selectedClassId}
                onChange={(e) => {
                  const id = e.target.value;
                  const cls = classes.find((c) => c.id === id);
                  setSelectedClassId(id);
                  setSelectedClassName(cls?.name || '');
                  setSearch('');
                  setFilterAssessmentType('');
                }}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white font-medium"
              >
                <option value="">-- Pilih Kelas --</option>
                {classes.filter(c => !selectedSchool || getSchoolIdForClass(c.id) === selectedSchool).map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} {cls.levelName && `(${cls.levelName})`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Jenis Penilaian */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Jenis Penilaian</label>
            <select
              value={filterAssessmentType}
              onChange={(e) => setFilterAssessmentType(e.target.value)}
              disabled={!selectedClassId}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white font-medium disabled:bg-gray-50 disabled:cursor-not-allowed"
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
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Cari Siswa
            </label>
            <input
              type="text"
              placeholder="Nama atau nomor stambuk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={!selectedClassId}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 placeholder-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      {selectedClassId && !isLoadingStudents && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow p-5 border-l-4 border-emerald-600">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-2 rounded-lg">
                <BookOpen size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Kelas</p>
                <p className="text-xl font-bold text-gray-900">{selectedClassName}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-5 border-l-4 border-blue-500">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Users size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Siswa</p>
                <p className="text-xl font-bold text-gray-900">{totalStudents}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {!selectedClassId ? (
        <div className="bg-white rounded-lg shadow p-16 text-center">
          <div className="bg-gray-100 p-5 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <BookOpen size={36} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Pilih Kelas</h3>
          <p className="text-gray-500 text-sm">Silakan pilih kelas untuk menampilkan daftar siswa</p>
        </div>
      ) : isLoadingStudents ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto mb-4" />
          <p className="text-gray-500">Memuat data siswa...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Users size={40} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">
            {search ? 'Tidak ada siswa yang cocok dengan pencarian' : 'Tidak ada siswa di kelas ini'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-emerald-600 px-6 py-3">
              <p className="text-white font-semibold text-sm">
                Kelas {selectedClassName} &mdash; {totalStudents} Siswa
              </p>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-12">
                    No
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-28">
                    Stambuk
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Nama Siswa
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider w-48">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.map((student, idx) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                      {student.nourut ?? (currentPage - 1) * itemsPerPage + idx + 1}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                      {student.studentNo}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-semibold">
                      {student.name}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() =>
                            router.push(
                              `/admin/raport-arab/detail?classId=${student.classId}&studentId=${student.id}${filterAssessmentType ? `&assessmentType=${filterAssessmentType}` : ''}`
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          <Eye size={14} />
                          Lihat Raport
                        </button>
                        <button
                          onClick={() =>
                            router.push(
                              `/admin/raport-arab/cover-preview?classId=${student.classId}&studentId=${student.id}${filterAssessmentType ? `&assessmentType=${filterAssessmentType}` : ''}`
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <BookOpen size={14} />
                          Sampul
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredStudents.map((student) => (
              <div
                key={student.id}
                className="bg-white rounded-lg shadow border border-gray-100 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{student.name}</p>
                    <p className="text-xs text-gray-500 mt-1">Stambuk: {student.studentNo}</p>
                  </div>
                  {student.nourut && (
                    <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">
                      #{student.nourut}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      router.push(
                        `/admin/raport-arab/detail?classId=${student.classId}&studentId=${student.id}${filterAssessmentType ? `&assessmentType=${filterAssessmentType}` : ''}`
                      )
                    }
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    <Eye size={14} />
                    Lihat Raport
                  </button>
                  <button
                    onClick={() =>
                      router.push(
                        `/admin/raport-arab/cover-preview?classId=${student.classId}&studentId=${student.id}${filterAssessmentType ? `&assessmentType=${filterAssessmentType}` : ''}`
                      )
                    }
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <BookOpen size={14} />
                    Sampul
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center bg-white rounded-lg shadow px-4 py-3">
              <p className="text-sm text-gray-600">
                Halaman <span className="font-bold text-gray-900">{currentPage}</span> dari{' '}
                <span className="font-bold text-gray-900">{totalPages}</span>
              </p>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={18} className="text-gray-600" />
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - currentPage) <= 1
                    )
                    .map((page, i, arr) => (
                      <Fragment key={page}>
                        {i > 0 && arr[i - 1] !== page - 1 && (
                          <span key={`dots-${page}`} className="px-1 text-gray-400 self-center">
                            ...
                          </span>
                        )}
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                            currentPage === page
                              ? 'bg-emerald-600 text-white font-semibold'
                              : 'border border-gray-300 hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          {page}
                        </button>
                      </Fragment>
                    ))}
                </div>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={18} className="text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
