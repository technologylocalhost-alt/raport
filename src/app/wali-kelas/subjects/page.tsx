'use client';

import { useEffect, useState } from 'react';
import { Library, AlertCircle, X, Search } from 'lucide-react';

interface Subject {
  id: string;
  code: string;
  name: string;
  nameArabic?: string;
  description?: string;
  creditHours?: number;
  classes: Array<{ id: string; name: string }>;
}

interface Class {
  id: string;
  name: string;
  levelId: string;
  levelName?: string;
}

interface ClassSubject {
  id: string;
  subject: {
    id: string;
    code: string;
    name: string;
    nameArabic?: string;
    description?: string;
    creditHours?: number;
  };
}

export default function WaliKelasSubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const itemsPerPage = 10;

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      const parsedUser = JSON.parse(user);
      fetchAllSubjects(parsedUser.id);
    }
  }, []);

  async function fetchAllSubjects(waliKelasId: string) {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch subjects assigned to this user (wali kelas/teacher) via ClassTeacher
      const subjectsResponse = await fetch(`/api/teacher/subjects`, { headers });
      const subjectsData = await subjectsResponse.json();

      console.log('Subjects from ClassTeacher:', subjectsData);

      if (!subjectsResponse.ok) {
        setErrorMessage('Gagal memuat mata pelajaran');
        return;
      }

      const fetchedSubjects: Subject[] = (subjectsData.data || []);
      console.log('Final unique subjects:', fetchedSubjects);
      setSubjects(fetchedSubjects);
      setErrorMessage('');
    } catch (error) {
      console.error('Error:', error);
      setErrorMessage('Gagal memuat mata pelajaran');
    } finally {
      setIsLoading(false);
    }
  }

  const sortedSubjects = [...subjects].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));
  
  // Get unique classes from all subjects
  const classMap = new Map<string, { id: string; name: string }>();
  sortedSubjects.forEach(subject => {
    subject.classes.forEach(cls => {
      if (!classMap.has(cls.id)) {
        classMap.set(cls.id, cls);
      }
    });
  });
  const allClasses = Array.from(classMap.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  // Filter subjects based on class and search
  const filteredSubjects = sortedSubjects.filter((subject) => {
    const matchesClass = !selectedClass || subject.classes.some(c => c.id === selectedClass);
    const matchesSearch = !searchText || 
      subject.code.toLowerCase().includes(searchText.toLowerCase()) ||
      subject.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (subject.nameArabic && subject.nameArabic.includes(searchText));
    return matchesClass && matchesSearch;
  });

  const paginatedSubjects = filteredSubjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredSubjects.length / itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClass, searchText]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Library size={32} className="text-emerald-600" />
          Mata Pelajaran
        </h1>
        <p className="text-gray-600 mt-1">Daftar semua mata pelajaran yang Anda ajarkan</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-gray-900 placeholder-gray-500"
                  />
                  <Search className="absolute right-3 top-3.5 text-gray-400" size={20} />
                </div>
              </div>

              {/* Class Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter Kelas
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors bg-white text-gray-900"
                >
                  <option value="">Semua Kelas</option>
                  {allClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {(searchText || selectedClass) && (
              <button
                onClick={() => {
                  setSearchText('');
                  setSelectedClass('');
                }}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                ✕ Hapus Filter
              </button>
            )}
          </div>

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
                  <p className="text-xs text-gray-500 mt-1">dari {sortedSubjects.length} total</p>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          {filteredSubjects.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <p className="text-gray-500 text-lg">
                {searchText || selectedClass ? 'Tidak ada mata pelajaran yang sesuai dengan filter.' : 'Tidak ada mata pelajaran ditemukan.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden border">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Kode</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nama</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-emerald-700 bg-emerald-50">Nama Arab</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Diajarkan di Kelas</th>
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
                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-wrap gap-2">
                            {subject.classes.map((classItem) => (
                              <a
                                key={classItem.id}
                                href={`/wali-kelas/subjects/${classItem.id}/students?subjectId=${subject.id}`}
                                className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold hover:bg-emerald-200 transition-colors cursor-pointer"
                              >
                                {classItem.name}
                              </a>
                            ))}
                          </div>
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
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">Diajarkan di Kelas</p>
                      <div className="flex flex-wrap gap-2">
                        {subject.classes.map((classItem) => (
                          <a
                            key={classItem.id}
                            href={`/wali-kelas/subjects/${classItem.id}/students?subjectId=${subject.id}`}
                            className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold hover:bg-emerald-200 transition-colors cursor-pointer"
                          >
                            {classItem.name}
                          </a>
                        ))}
                      </div>
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
    </div>
  );
}
