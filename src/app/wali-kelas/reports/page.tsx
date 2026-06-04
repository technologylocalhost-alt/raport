'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { devError } from '@/lib/dev-log';
import { clearAuthData, getCurrentUser } from '@/lib/auth/client';

interface Student {
  id: string;
  name: string;
  studentNo: string;
  classId: string;
  className: string;
}

export default function WaliKelasReportsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchStudents = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      
      const user = getCurrentUser();
      const userId = user?.id;
      if (!userId || userId.trim() === '') {
        clearAuthData();
        setErrorMessage('Sesi Anda telah berakhir. Silakan login kembali');
        setTimeout(() => router.push('/login'), 1500);
        setIsLoading(false);
        return;
      }

      // Get all classes for this wali kelas
      const classesResponse = await apiFetch(`/api/admin/classes?limit=100&waliKelasId=${userId}`);
      
      // Validation: Check response status
      if (classesResponse.status === 401) {
        clearAuthData();
        setErrorMessage('Sesi Anda telah berakhir. Silakan login kembali');
        setTimeout(() => router.push('/login'), 1500);
        setIsLoading(false);
        return;
      }

      if (classesResponse.status === 403) {
        setErrorMessage('Anda tidak memiliki akses untuk melihat laporan');
        setIsLoading(false);
        return;
      }

      if (!classesResponse.ok) {
        setErrorMessage(`Gagal memuat daftar kelas (Error: ${classesResponse.status})`);
        setIsLoading(false);
        return;
      }

      const classesData = await classesResponse.json();

      // Validation: Check response format
      if (!classesData.success || !Array.isArray(classesData.data)) {
        setErrorMessage('Format data kelas tidak valid');
        setIsLoading(false);
        return;
      }

      const classes = classesData.data || [];
      
      // Validation: Check if wali-kelas has any classes
      if (classes.length === 0) {
        setStudents([]);
        setIsLoading(false);
        return;
      }
      
      // Collect all students from all classes
      const allStudents: Student[] = [];
      
      for (const cls of classes) {
        // Validation: Check class object
        if (!cls.id || cls.id.trim() === '') {
          continue;
        }

        const studentsResponse = await apiFetch(`/api/admin/classes/${cls.id}/students?limit=1000`);
        
        // Validation: Check response status
        if (studentsResponse.status === 401) {
          clearAuthData();
          setErrorMessage('Sesi Anda telah berakhir. Silakan login kembali');
          setTimeout(() => router.push('/login'), 1500);
          setIsLoading(false);
          return;
        }

        if (studentsResponse.status === 403) {
          continue;
        }

        if (!studentsResponse.ok) {
          continue;
        }

        const studentsData = await studentsResponse.json();
        
        // Validation: Check response format
        if (studentsData.success && Array.isArray(studentsData.data)) {
          const classStudents = (studentsData.data || []).map((student: { id: string; name: string; nisn?: string; studentNo?: string }) => ({
            id: student.id,
            name: student.name,
            studentNo: student.nisn || student.studentNo || '-',
            classId: cls.id,
            className: cls.name,
          }));
          allStudents.push(...classStudents);
        } else {
        }
      }

      setStudents(allStudents);
      setIsLoading(false);
    } catch (error) {
      devError('Error fetching students:', error);
      setErrorMessage('Terjadi kesalahan saat memuat data siswa. Periksa koneksi Anda dan coba lagi');
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchStudents();
  }, [fetchStudents]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Laporan Raport</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-2">Daftar siswa dan lihat raport individual</p>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-red-800">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage('')}
            className="text-red-600 hover:text-red-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-600">Memuat data...</p>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-yellow-800">
            📌 Tidak ada siswa dalam kelas Anda atau Anda belum ditugaskan sebagai Wali Kelas.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-emerald-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold text-gray-900">Kelas</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-900">No. Induk</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-900">Nama Siswa</th>
                  <th className="px-6 py-4 text-right font-semibold text-gray-900">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        {student.className}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{student.studentNo}</td>
                    <td className="px-6 py-4 text-gray-900 font-medium">{student.name}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => router.push(`/wali-kelas/reports/detail?classId=${student.classId}&studentId=${student.id}`)}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 transition-colors"
                      >
                        <Eye size={14} />
                        Lihat Raport
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {students.map((student) => (
              <div
                key={student.id}
                className="bg-white rounded-lg border border-gray-200 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1">
                    <h3 className="font-semibold text-gray-900">{student.name}</h3>
                    <p className="text-xs text-gray-600">No. Induk: {student.studentNo}</p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 flex-shrink-0">
                    {student.className}
                  </span>
                </div>
                <button
                  onClick={() => router.push(`/wali-kelas/reports/detail?classId=${student.classId}&studentId=${student.id}`)}
                  className="w-full px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Eye size={14} />
                  Lihat Raport
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
