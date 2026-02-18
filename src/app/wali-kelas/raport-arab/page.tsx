'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Search, Download, Eye, FileText } from 'lucide-react';

interface Class {
  id: string;
  name: string;
  code: string;
}

interface Student {
  id: string;
  name: string;
  studentNo: string;
  raportNo?: string;
}

interface ClassWithStudents extends Class {
  students: Student[];
}

export default function RaportArabPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassWithStudents[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');


  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      setError('');
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');

      if (!token || token.trim() === '') {
        setError('Sesi Anda telah berakhir. Silakan login kembali');
        setTimeout(() => router.push('/login'), 1500);
        return;
      }

      const response = await fetch('/api/admin/classes?limit=100', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        setError('Sesi Anda telah berakhir. Silakan login kembali');
        setTimeout(() => router.push('/login'), 1500);
        return;
      }

      if (!response.ok) {
        throw new Error('Gagal memuat data kelas');
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        // Fetch students for each class
        const classesWithStudents = await Promise.all(
          data.data.map(async (cls: any) => {
            try {
              const studentsResponse = await fetch(
                `/api/admin/classes/${cls.id}/students?limit=100`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              let students: Student[] = [];
              if (studentsResponse.ok) {
                const studentsData = await studentsResponse.json();
                if (studentsData.success && Array.isArray(studentsData.data)) {
                  students = studentsData.data.map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    studentNo: s.studentNo,
                    raportNo: s.raportNo || null,
                  }));
                }
              }

              return {
                ...cls,
                students,
              };
            } catch (err) {
              console.warn(`Failed to fetch students for class ${cls.id}`);
              return {
                ...cls,
                students: [],
              };
            }
          })
        );

        setClasses(classesWithStudents);
      }
    } catch (err) {
      console.error('Error fetching classes:', err);
      setError('Terjadi kesalahan saat memuat data kelas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewRaport = (classId: string, studentId: string) => {
    router.push(
      `/wali-kelas/raport-arab/detail?classId=${classId}&studentId=${studentId}`
    );
  };

  // Filter classes based on search and selected class
  const getFilteredStudents = () => {
    if (!selectedClass) return [];

    const selectedClassObj = classes.find((cls) => cls.id === selectedClass);
    if (!selectedClassObj) return [];

    return selectedClassObj.students.filter((student) => {
      const matchSearch =
        !searchQuery ||
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.studentNo.toLowerCase().includes(searchQuery.toLowerCase());

      return matchSearch;
    });
  };

  const filteredStudents = getFilteredStudents();
  const selectedClassObj = classes.find((cls) => cls.id === selectedClass);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-md"
            >
              <ArrowLeft size={20} />
              Kembali
            </button>
            <h1 className="text-3xl font-bold text-emerald-900">Raport Peserta Didik</h1>
          </div>
        </div>

        {/* Data Table Card */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {error && (
            <div className="p-6 bg-red-50 border-b border-red-200 text-red-700 rounded-t-lg">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="p-8 text-center text-gray-500">
              Memuat data raport...
            </div>
          ) : (
            <>
              {/* Filter Section */}
              <div className="p-6 border-b border-gray-200 bg-gray-50 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Search */}
                  <div className="relative">
                    <Search size={18} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari nama, nomor induk, atau kelas..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                    />
                  </div>

                  {/* Class Filter */}
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white"
                  >
                    <option value="">Semua Kelas</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Summary */}
                <p className="text-sm text-gray-600">
                  {selectedClass ? (
                    <>Total: {filteredStudents.length} siswa di kelas {selectedClassObj?.name}</>
                  ) : (
                    <>Silakan pilih kelas untuk melihat data</>
                  )}
                </p>
              </div>

              {/* Table Display */}
              <div className="p-6">
                {!selectedClass ? (
                  <div className="p-8 text-center text-gray-500">
                    <p className="text-lg font-semibold mb-2">Silakan Pilih Kelas</p>
                    <p className="text-sm">Pilih kelas dari dropdown di atas untuk menampilkan data siswa</p>
                  </div>
                ) : filteredStudents.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-200">
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">NO</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">NAMA SISWA</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">NOMOR INDUK</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">NOMOR RAPORT</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">AKSI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student, idx) => (
                          <tr key={student.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-sm text-gray-900 font-medium">{idx + 1}</td>
                            <td className="px-6 py-4 text-sm text-gray-900">{student.name}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{student.studentNo}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{student.raportNo || '-'}</td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => router.push(`/wali-kelas/raport-arab/cover-preview?classId=${selectedClass}&studentId=${student.id}`)}
                                  className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-xs font-medium"
                                  title="Sampul Raport"
                                >
                                  <Printer size={16} />
                                  Sampul
                                </button>
                                <button
                                  onClick={() => handleViewRaport(selectedClass, student.id)}
                                  className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors text-xs font-medium"
                                  title="Review Individual"
                                >
                                  <FileText size={16} />
                                  Review
                                </button>
                                <button
                                  onClick={() => router.push('/wali-kelas/raport-arab/bulk-review')}
                                  className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium"
                                  title="Review Keseluruhan"
                                >
                                  <Eye size={16} />
                                  Semua
                                </button>
                                <button
                                  onClick={() => router.push('/wali-kelas/raport-arab/bulk-download')}
                                  className="flex items-center gap-1 px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors text-xs font-medium"
                                  title="Download"
                                >
                                  <Download size={16} />
                                  Unduh
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    Tidak ada data siswa ditemukan
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 p-6 bg-emerald-50 border-l-4 border-emerald-600 rounded-lg">
          <h3 className="font-semibold text-emerald-900 mb-2">Panduan Penggunaan</h3>
          <ul className="text-sm text-emerald-800 space-y-1">
            <li>• <strong>Sampul</strong> - Lihat dan cetak sampul raport siswa</li>
            <li>• <strong>Review</strong> - Lihat raport individual siswa</li>
            <li>• <strong>Semua</strong> - Review raport keseluruhan kelas</li>
            <li>• <strong>Unduh</strong> - Download raport dalam format PDF</li>
            <li>• Gunakan pencarian atau filter untuk menemukan siswa tertentu</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
