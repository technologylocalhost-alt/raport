'use client';

import { useEffect, useState } from 'react';
import { Library, AlertCircle, X } from 'lucide-react';

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

  const paginatedSubjects = subjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(subjects.length / itemsPerPage);

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
          {/* Stats */}
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-emerald-600">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-100 p-4 rounded-lg">
                <Library className="text-emerald-600" size={28} />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total Mata Pelajaran</p>
                <p className="text-3xl font-bold text-gray-900">{subjects.length}</p>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden border">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Kode</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nama</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-emerald-700 bg-emerald-50">Nama Arab</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Deskripsi</th>
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
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                      {subject.description || '-'}
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

          {/* Pagination */}
          {subjects.length > itemsPerPage && (
            <div className="flex items-center justify-between mt-6 px-2 bg-gray-50 py-4 rounded-lg">
              <div className="text-sm font-medium text-gray-700">
                Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, subjects.length)} dari {subjects.length} mata pelajaran
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-emerald-50 hover:border-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Sebelumnya
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 rounded-lg font-semibold transition-colors ${
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
                  className="px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-emerald-50 hover:border-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Selanjutnya →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
