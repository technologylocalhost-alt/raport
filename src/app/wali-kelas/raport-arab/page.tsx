'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Search, Download, Eye } from 'lucide-react';

interface Class {
  id: string;
  name: string;
  code: string;
}

interface Student {
  id: string;
  name: string;
  studentNo: string;
}

interface ClassWithStudents extends Class {
  students: Student[];
}

export default function RaportArabPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassWithStudents[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      setError('');
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
    }
  };

  const handleViewRaport = () => {
    if (!selectedClass) {
      setError('Silakan pilih kelas');
      return;
    }

    if (!selectedStudent) {
      setError('Silakan pilih siswa');
      return;
    }

    router.push(
      `/wali-kelas/raport-arab/detail?classId=${selectedClass}&studentId=${selectedStudent}`
    );
  };

  const currentClass = classes.find((c) => c.id === selectedClass);
  const filteredStudents = currentClass
    ? currentClass.students.filter((s) =>
        `${s.name} ${s.studentNo}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-md"
          >
            <ArrowLeft size={20} />
            Kembali
          </button>
          <h1 className="text-3xl font-bold text-emerald-900">Raport Peserta Didik</h1>
        </div>

        {/* Menu Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => {}}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors shadow-md"
          >
            <Printer size={20} />
            Review Individual
          </button>
          <button
            onClick={() => router.push('/wali-kelas/raport-arab/bulk-review')}
            className="flex items-center gap-2 px-6 py-3 bg-white text-emerald-600 border-2 border-emerald-600 rounded-lg font-semibold hover:bg-emerald-50 transition-colors"
          >
            <Eye size={20} />
            Review Keseluruhan
          </button>
          <button
            onClick={() => router.push('/wali-kelas/raport-arab/bulk-download')}
            className="flex items-center gap-2 px-6 py-3 bg-white text-emerald-600 border-2 border-emerald-600 rounded-lg font-semibold hover:bg-emerald-50 transition-colors"
          >
            <Download size={20} />
            Download Semua
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Class Selection */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Pilih Kelas
            </label>
            <div className="grid grid-cols-2 gap-3">
              {classes.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => {
                    setSelectedClass(cls.id);
                    setSelectedStudent('');
                    setSearchQuery('');
                  }}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedClass === cls.id
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-gray-200 bg-gray-50 hover:border-emerald-400'
                  }`}
                >
                  <div className="font-semibold text-gray-900">{cls.name}</div>
                  <div className="text-sm text-gray-600">{cls.students.length} siswa</div>
                </button>
              ))}
            </div>
          </div>

          {/* Student Selection */}
          {selectedClass && (
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Pilih Siswa
              </label>

              {/* Search */}
              <div className="mb-4 relative">
                <Search size={18} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari nama atau nomor induk siswa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Student List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => (
                    <button
                      key={student.id}
                      onClick={() => setSelectedStudent(student.id)}
                      className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                        selectedStudent === student.id
                          ? 'border-emerald-600 bg-emerald-50'
                          : 'border-gray-200 bg-gray-50 hover:border-emerald-400'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{student.name}</div>
                      <div className="text-sm text-gray-600">NIK: {student.studentNo}</div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-500">Tidak ada siswa ditemukan</div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-8 border-t border-gray-200">
            <button
              onClick={handleViewRaport}
              disabled={!selectedClass || !selectedStudent}
              className={`flex-1 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                selectedClass && selectedStudent
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Printer size={20} />
              Lihat Raport
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 p-6 bg-emerald-50 border-l-4 border-emerald-600 rounded-lg">
          <h3 className="font-semibold text-emerald-900 mb-2">Informasi</h3>
          <ul className="text-sm text-emerald-800 space-y-1">
            <li>• Pilih kelas untuk melihat daftar siswa</li>
            <li>• Cari siswa berdasarkan nama atau nomor induk</li>
            <li>• Klik "Lihat Raport" untuk menampilkan raport peserta didik</li>
            <li>• Gunakan tombol Cetak untuk mencetak raport</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
