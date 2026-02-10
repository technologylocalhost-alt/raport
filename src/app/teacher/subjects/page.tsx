'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen } from 'lucide-react';

interface Subject {
  id: string;
  name: string;
  code: string;
  description?: string;
  class?: {
    id: string;
    name: string;
    level?: {
      name: string;
    };
  };
}

interface ApiResponse {
  success: boolean;
  data?: Subject[];
  message?: string;
}

export default function TeacherSubjectsPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTeacherSubjects();
  }, []);

  async function fetchTeacherSubjects() {
    try {
      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch('/api/teacher/subjects', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: ApiResponse = await response.json();
      
      if (data.success && data.data) {
        setSubjects(data.data);
      } else {
        setError(data.message || 'Gagal memuat mata pelajaran');
      }
    } catch (error) {
      console.error('Failed to fetch subjects:', error);
      setError('Terjadi kesalahan saat memuat data mata pelajaran');
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Memuat mata pelajaran...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mata Pelajaran Saya</h1>
          <p className="text-gray-600 text-sm mt-1">Kelola semua mata pelajaran yang Anda ajar</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && subjects.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="bg-indigo-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="text-indigo-600" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Mata Pelajaran</h3>
          <p className="text-gray-600">Anda belum terdaftar mengajar mata pelajaran apapun.</p>
        </div>
      ) : (
        /* Table */
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              {/* Table Head */}
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    No.
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Nama Mata Pelajaran
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Kode
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Kelas
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Tingkat
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Deskripsi
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              {/* Table Body */}
              <tbody className="divide-y divide-gray-200">
                {subjects.map((subject, index) => (
                  <tr key={subject.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{index + 1}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{subject.name}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {subject.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{subject.class?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{subject.class?.level?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="line-clamp-2 max-w-xs">{subject.description || '-'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm space-y-2">
                      <div className="flex gap-2 justify-center flex-wrap">
                        <button
                          onClick={() => router.push(`/teacher/subjects/${subject.class?.id}/students?subjectId=${subject.id}`)}
                          className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                        >
                          Lihat Siswa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary */}
      {subjects.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-center justify-between">
          <span className="font-medium">Total Mata Pelajaran: <strong>{subjects.length}</strong></span>
          <span className="text-sm">Anda mengajar {subjects.length} mata pelajaran</span>
        </div>
      )}
    </div>
  );
}
