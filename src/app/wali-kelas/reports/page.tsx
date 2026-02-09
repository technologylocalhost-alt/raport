'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Eye, FileText, AlertCircle, Users } from 'lucide-react';

interface Class {
  id: string;
  name: string;
  levelName?: string;
  schoolYear?: string;
  _count?: {
    students?: number;
  };
}

export default function WaliKelasReportsPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [dummyStudents, setDummyStudents] = useState<any[]>([]);

  useEffect(() => {
    fetchClasses();
  }, []);

  async function fetchClasses() {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      const user = localStorage.getItem('user');
      
      if (!user) {
        router.push('/login');
        return;
      }

      const { id: userId } = JSON.parse(user);
      const headers = { Authorization: `Bearer ${token}` };

      const response = await fetch(`/api/admin/classes?limit=100&waliKelasId=${userId}`, { headers });
      const data = await response.json();

      if (response.ok) {
        // Transform classes to extract nested object values
        const transformedClasses = (data.data || []).map((c: any) => ({
          ...c,
          levelName: c.level?.name || '-',
          schoolYear: c.schoolYear?.year || '-',
        }));
        setClasses(transformedClasses);
      } else {
        setErrorMessage('Gagal memuat daftar kelas');
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
      setErrorMessage('Gagal memuat daftar kelas');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGenerateReport(classId: string, className: string) {
    try {
      setSuccessMessage(`Laporan untuk kelas ${className} sedang diproses...`);
      // TODO: Implement report generation
      // For now, just show a message
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error generating report:', error);
      setErrorMessage('Gagal membuat laporan');
    }
  }

  function handleViewStudents(classId: string) {
    if (expandedClass === classId) {
      setExpandedClass(null);
    } else {
      // Generate dummy students for the class
      const students = [
        { id: 'STU001', name: 'Aldi Pratama', studentNo: '001/XII.IPA.1/2024' },
        { id: 'STU002', name: 'Budi Santoso', studentNo: '002/XII.IPA.1/2024' },
        { id: 'STU003', name: 'Citra Dewi', studentNo: '003/XII.IPA.1/2024' },
        { id: 'STU004', name: 'Dina Kusuma', studentNo: '004/XII.IPA.1/2024' },
        { id: 'STU005', name: 'Eka Putri', studentNo: '005/XII.IPA.1/2024' },
      ];
      setDummyStudents(students);
      setExpandedClass(classId);
    }
  }

  function handleViewReport(classId: string, studentId: string) {
    router.push(`/wali-kelas/reports/detail?classId=${classId}&studentId=${studentId}`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Laporan Raport</h1>
        <p className="text-gray-600 mt-2">Lihat dan unduh laporan raport untuk setiap kelas</p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <FileText className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-green-800">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage('')}
            className="text-green-600 hover:text-green-800"
          >
            ✕
          </button>
        </div>
      )}

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
          <p className="text-gray-600">Memuat data kelas...</p>
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-yellow-800">
            📌 Anda belum ditugaskan sebagai Wali Kelas di kelas manapun.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {classes.map((classItem) => (
            <div key={classItem.id}>
              <div className="bg-white rounded-lg shadow-md border-l-4 border-emerald-500 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900">{classItem.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{classItem.levelName}</p>
                    <p className="text-xs text-gray-500">{classItem.schoolYear}</p>
                  </div>
                  <FileText className="text-emerald-600" size={24} />
                </div>

                <div className="mb-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">{classItem._count?.students || 0}</span> siswa
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewStudents(classItem.id)}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                  >
                    <Users size={16} />
                    {expandedClass === classItem.id ? 'Sembunyikan Siswa' : 'Lihat Siswa'}
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                    title="Fitur unduh akan segera tersedia"
                  >
                    <Download size={16} />
                    Unduh Semua
                  </button>
                </div>
              </div>

              {/* Expanded Student List */}
              {expandedClass === classItem.id && (
                <div className="mt-2 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-emerald-100 border-b border-gray-200">
                        <th className="px-6 py-3 text-left font-semibold text-gray-900">
                          No. Induk
                        </th>
                        <th className="px-6 py-3 text-left font-semibold text-gray-900">Nama Siswa</th>
                        <th className="px-6 py-3 text-right font-semibold text-gray-900">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dummyStudents.map((student, idx) => (
                        <tr key={student.id} className="border-b border-gray-200 hover:bg-white">
                          <td className="px-6 py-3 text-gray-700">{student.studentNo}</td>
                          <td className="px-6 py-3 text-gray-700">{student.name}</td>
                          <td className="px-6 py-3 text-right">
                            <button
                              onClick={() => handleViewReport(classItem.id, student.id)}
                              className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 transition-colors"
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
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Informasi</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Laporan menampilkan ringkasan nilai dan absensi siswa</li>
          <li>Data akan diperbarui secara otomatis setiap kali ada inputan baru</li>
          <li>Anda dapat mengunduh laporan dalam format PDF atau Excel</li>
        </ul>
      </div>
    </div>
  );
}
