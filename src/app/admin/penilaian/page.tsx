'use client';

import { useEffect, useState } from 'react';
import { Library, AlertCircle, X, Search, RotateCw } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
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

interface Subject {
  id: string;
  code: string;
  name: string;
  nameArabic?: string;
  description?: string;
  creditHours?: number;
  levelId?: string;
  classes: Array<{ id: string; name: string; schoolYearId?: string }>;
}

export default function AdminPenilaianPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const itemsPerPage = 10;

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    try {
      setIsLoading(true);

      // Fetch schools
      const schoolsRes = await apiFetch('/api/admin/schools?limit=100');
      const schoolsData = await schoolsRes.json();
      setSchools(schoolsData.data || []);

      // Fetch levels with their school info
      const levelsRes = await apiFetch('/api/admin/levels?limit=1000');
      const levelsData = await levelsRes.json();
      setLevels(levelsData.data || []);

      // Fetch school years
      const yearsRes = await apiFetch('/api/admin/school-years?limit=100');
      const yearsData = await yearsRes.json();
      setSchoolYears(yearsData.data || []);

      // Fetch subjects with their classes
      const subjectsResponse = await apiFetch(`/api/admin/subjects-with-classes`);
      const subjectsData = await subjectsResponse.json();

      if (!subjectsResponse.ok) {
        setErrorMessage('Gagal memuat mata pelajaran');
        return;
      }

      const fetchedSubjects: Subject[] = (subjectsData.data || []);
      setSubjects(fetchedSubjects);
      setErrorMessage('');
    } catch (error) {
      devError('Error:', error);
      setErrorMessage('Gagal memuat mata pelajaran');
    } finally {
      setIsLoading(false);
    }
  }

  const sortedSubjects = [...subjects].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));

  // Helper function to get school ID for a subject
  const getSchoolIdForSubject = (subject: Subject): string | undefined => {
    if (!subject.levelId) return undefined;
    const level = levels.find(l => l.id === subject.levelId);
    return level?.schoolId;
  };

  // Get unique classes from all subjects, filtered by selected school and school year
  const classMap = new Map<string, { id: string; name: string; schoolYearId?: string }>();
  sortedSubjects.forEach(subject => {
    const subjectSchoolId = getSchoolIdForSubject(subject);
    // Skip if school filter is set and subject doesn't match
    if (selectedSchool && subjectSchoolId !== selectedSchool) return;
    
    subject.classes.forEach(cls => {
      // Only add classes that match the selected school year (if one is selected)
      if (!selectedSchoolYear || cls.schoolYearId === selectedSchoolYear) {
        if (!classMap.has(cls.id)) {
          classMap.set(cls.id, cls);
        }
      }
    });
  });
  const allClasses = Array.from(classMap.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  // Filter subjects based on school, school year, class and search
  const filteredSubjects = sortedSubjects.filter((subject) => {
    const subjectSchoolId = getSchoolIdForSubject(subject);
    const matchesSchool = !selectedSchool || subjectSchoolId === selectedSchool;
    const matchesSchoolYear = !selectedSchoolYear || subject.classes.some(c => c.schoolYearId === selectedSchoolYear);
    const matchesClass = !selectedClass || subject.classes.some(c => c.id === selectedClass);
    const matchesSearch = !searchText || 
      subject.code.toLowerCase().includes(searchText.toLowerCase()) ||
      subject.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (subject.nameArabic && subject.nameArabic.includes(searchText));
    return matchesSchool && matchesSchoolYear && matchesClass && matchesSearch;
  });

  const paginatedSubjects = filteredSubjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredSubjects.length / itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSchool, selectedSchoolYear, selectedClass, searchText]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchInitialData();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Library size={32} className="text-emerald-600" />
            Penilaian
          </h1>
          <p className="text-gray-600 mt-1">Kelola nilai siswa per mata pelajaran</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh penilaian terbaru"
        >
          <RotateCw size={24} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {errorMessage}
          <button onClick={() => setErrorMessage('')} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">Memuat mata pelajaran...</p>
        </div>
      ) : subjects.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-yellow-800">Belum ada mata pelajaran terdaftar.</p>
        </div>
      ) : (
        <>
          {/* Filter and Search */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Filter dan Pencarian</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* School Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sekolah
                </label>
                <select
                  value={selectedSchool}
                  onChange={(e) => {
                    setSelectedSchool(e.target.value);
                    setSelectedSchoolYear('');
                    setSelectedClass('');
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors bg-white text-gray-900"
                >
                  <option value="">-- Semua Sekolah --</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* School Year Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tahun Ajaran
                </label>
                <select
                  value={selectedSchoolYear}
                  onChange={(e) => {
                    setSelectedSchoolYear(e.target.value);
                    setSelectedClass('');
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors bg-white text-gray-900"
                >
                  <option value="">-- Semua Tahun --</option>
                  {schoolYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.year} {year.isActive ? '(Aktif)' : '(Nonaktif)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Class Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pilih Kelas
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors bg-white text-gray-900"
                >
                  <option value="">-- Pilih Kelas --</option>
                  {allClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cari Mata Pelajaran
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Cari kode atau nama..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    disabled={!selectedClass}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-gray-900 placeholder-gray-500 disabled:bg-gray-100 disabled:text-gray-400"
                  />
                  <Search className="absolute right-3 top-3.5 text-gray-400" size={20} />
                </div>
              </div>
            </div>
            {(searchText || selectedClass || selectedSchoolYear) && (
              <button
                onClick={() => {
                  setSearchText('');
                  setSelectedClass('');
                  setSelectedSchoolYear('');
                }}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                ✕ Hapus Filter
              </button>
            )}
          </div>

          {selectedClass && (
            <>
              {/* Stats */}
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-emerald-600">
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-100 p-4 rounded-lg">
                    <Library className="text-emerald-600" size={28} />
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Mata Pelajaran Ditemukan</p>
                    <p className="text-3xl font-bold text-gray-900">{filteredSubjects.length}</p>
                    {(searchText || selectedClass) && (
                      <p className="text-xs text-gray-500 mt-1">dari {sortedSubjects.filter((s) => s.classes.some(c => c.id === selectedClass)).length} total</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Table */}
              {filteredSubjects.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                  <p className="text-gray-500 text-lg">
                    {searchText ? 'Tidak ada mata pelajaran yang sesuai dengan pencarian.' : 'Tidak ada mata pelajaran untuk kelas ini.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block bg-white rounded-lg shadow overflow-x-auto border">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Kode</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nama</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-emerald-700 bg-emerald-50">Nama Arab</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedSubjects.map((subject) => (
                          <tr key={subject.id} className="border-b hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{subject.code}</td>
                            <td className="px-6 py-4 text-sm text-gray-700">{subject.name}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-emerald-700 bg-emerald-50">
                              {subject.nameArabic || '-'}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <a
                                href={`/admin/penilaian/${selectedClass}/subjects/${subject.id}/students`}
                                className="inline-block bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm"
                              >
                                Kelola Nilai
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards View */}
                  <div className="md:hidden space-y-4">
                    {paginatedSubjects.map((subject) => (
                      <div key={subject.id} className="bg-white rounded-lg shadow border border-gray-200 p-4">
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-600">Kode</p>
                          <p className="text-lg font-bold text-gray-900">{subject.code}</p>
                        </div>
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-600">Nama</p>
                          <p className="text-base text-gray-900">{subject.name}</p>
                        </div>
                        <div className="mb-3 pb-3 border-b border-gray-200">
                          <p className="text-sm font-medium text-gray-600">Nama Arab</p>
                          <p className="text-base font-semibold text-emerald-700">{subject.nameArabic || '-'}</p>
                        </div>
                        <div className="text-center">
                          <a
                            href={`/admin/penilaian/${selectedClass}/subjects/${subject.id}/students`}
                            className="inline-block w-full bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm"
                          >
                            Kelola Nilai
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Pagination */}
              {filteredSubjects.length > itemsPerPage && (
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mt-6 px-2 bg-gray-50 py-4 rounded-lg gap-4">
                  <div className="text-sm font-medium text-gray-700 text-center md:text-left order-2 md:order-1">
                    Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredSubjects.length)} dari {filteredSubjects.length}
                  </div>
                  <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 order-1 md:order-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm bg-emerald-600 text-white border-2 border-emerald-600 font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-300 disabled:border-gray-300 disabled:cursor-not-allowed"
                    >
                      ←
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        if (totalPages <= 5) return i + 1;
                        if (currentPage <= 3) return i + 1;
                        if (currentPage >= totalPages - 2) return totalPages - 4 + i;
                        return currentPage - 2 + i;
                      }).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-2 md:px-3 py-1 md:py-2 text-xs md:text-sm rounded-lg font-semibold transition-colors ${
                            page === currentPage
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'border-2 border-gray-300 text-gray-700 hover:border-emerald-600 hover:text-emerald-600'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm bg-emerald-600 text-white border-2 border-emerald-600 font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-300 disabled:border-gray-300 disabled:cursor-not-allowed"
                    >
                      →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {!selectedClass && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <p className="text-blue-800">
                {!selectedSchoolYear 
                  ? 'Pilih tahun ajaran dan kelas di atas untuk melihat mata pelajaran yang tersedia.' 
                  : 'Pilih kelas di atas untuk melihat mata pelajaran yang tersedia.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
