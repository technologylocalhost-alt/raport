'use client';

import { useCallback, useEffect, useState, FormEvent, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Search, ChevronLeft, ChevronRight, X, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { getCurrentUser } from '@/lib/auth/client';
import { devError } from '@/lib/dev-log';

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName?: string;
  date: string;
  status: 'HADIR' | 'SAKIT' | 'IZIN' | 'ALFA';
  notes?: string;
}

interface Class {
  id: string;
  name: string;
  levelId: string;
  levelName?: string;
  semesterId: string;
  semesterNumber?: number;
  capacity: number;
  schoolYearId: string;
  schoolYear?: string | {
    id: string;
    year: string;
    isActive?: boolean;
  };
  waliKelasId: string;
  _count?: {
    students?: number;
  };
}

interface FormData {
  studentId: string;
  date: string;
  status: 'HADIR' | 'SAKIT' | 'IZIN' | 'ALFA';
  notes: string;
}

function normalizeSchoolYear(value: Class['schoolYear']) {
  if (!value) return '-';
  if (typeof value === 'string') return value;
  return value?.year || '-';
}

interface StudentOption {
  id: string;
  name: string;
  studentNo?: string;
}

interface ClassApiItem extends Class {
  level?: { name?: string };
  schoolYearData?: { year?: string };
}

export default function WaliKelasAttendancePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AttendancePageContent />
    </Suspense>
  );
}

function AttendancePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [classes, setClasses] = useState<Class[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedClassName, setSelectedClassName] = useState<string>('');

  const [formData, setFormData] = useState<FormData>({
    studentId: '',
    date: new Date().toISOString().split('T')[0],
    status: 'HADIR',
    notes: '',
  });

  const itemsPerPage = 10;

  useEffect(() => {
    const parsedUser = getCurrentUser();
    if (parsedUser) {
      const classIdParam = searchParams.get('classId');
      if (classIdParam) {
        setSelectedClassId(classIdParam);
        void fetchClassNameAndStudents(classIdParam);
      } else {
        void fetchClasses(parsedUser.id);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedClassId) {
      void fetchClassNameAndStudents(selectedClassId);
    }
  }, [selectedClassId]);

  async function fetchClasses(waliKelasId: string) {
    try {
      setIsLoading(true);
      const response = await apiFetch(`/api/admin/classes?limit=100&waliKelasId=${waliKelasId}`);
      const data = await response.json();

      if (response.ok) {
        // Transform classes to extract nested object values
        const transformedClasses = ((data.data || []) as ClassApiItem[]).map((c) => ({
          ...c,
          levelName: c.level?.name || '-',
          schoolYear: normalizeSchoolYear(c.schoolYearData?.year || c.schoolYear),
        }));
        setClasses(transformedClasses);
      } else {
        setErrorMessage('Gagal memuat daftar kelas');
      }
    } catch (error) {
      devError('Error fetching classes:', error);
      setErrorMessage('Gagal memuat daftar kelas');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchClassNameAndStudents(classId: string) {
    try {
      // Fetch class details
      const classResponse = await apiFetch(`/api/admin/classes/${classId}`);
      const classData = await classResponse.json();

      if (classResponse.ok && classData.data) {
        setSelectedClassName(classData.data.name);
      }

      // Fetch students for this class
      const studentsResponse = await apiFetch(`/api/admin/classes/${classId}/students?limit=100`);
      const studentsData = await studentsResponse.json();

      if (studentsResponse.ok) {
        setStudents(studentsData.data || []);
      } else {
        setErrorMessage(studentsData.error || 'Gagal memuat data siswa');
      }
      
      setIsLoading(false);
    } catch (error) {
      devError('Error fetching class and students:', error);
      setErrorMessage('Gagal memuat data');
      setIsLoading(false);
    }
  }

  const fetchAttendances = useCallback(async () => {
    if (!selectedClassId) return;

    try {
      setIsLoading(true);
      const skip = (currentPage - 1) * itemsPerPage;
      const url = `/api/teacher/attendance?limit=${itemsPerPage}&skip=${skip}&classId=${selectedClassId}${searchTerm ? `&search=${searchTerm}` : ''}`;

      const response = await apiFetch(url);
      const data = await response.json();

      if (response.ok) {
        setAttendances(data.data || []);
        const total = data.meta?.total || 0;
        setTotalPages(Math.ceil(total / itemsPerPage));
      }
    } catch (error) {
      devError('Error fetching attendances:', error);
      setErrorMessage('Gagal memuat data absensi');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, selectedClassId]);

  useEffect(() => {
    if (selectedClassId) {
      void fetchAttendances();
    }
  }, [selectedClassId, fetchAttendances]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!formData.studentId || !formData.date) {
      setErrorMessage('Siswa dan Tanggal harus diisi');
      return;
    }

    try {
      const url = editingId ? `/api/teacher/attendance/${editingId}` : '/api/teacher/attendance';
      const method = editingId ? 'PUT' : 'POST';

      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSuccessMessage(editingId ? 'Absensi berhasil diperbarui' : 'Absensi berhasil ditambahkan');
        setShowForm(false);
        setEditingId(null);
        setFormData({
          studentId: '',
          date: new Date().toISOString().split('T')[0],
          status: 'HADIR',
          notes: '',
        });
        setCurrentPage(1);
        void fetchAttendances();
      } else {
        const error = await response.json();
        setErrorMessage(error.error || 'Terjadi kesalahan');
      }
    } catch (error) {
      devError('Error submitting form:', error);
      setErrorMessage('Terjadi kesalahan saat menyimpan data');
    }
  }

  async function handleEdit(record: AttendanceRecord) {
    setEditingId(record.id);
    setFormData({
      studentId: record.studentId,
      date: record.date.split('T')[0],
      status: record.status,
      notes: record.notes || '',
    });
    setShowForm(true);
    setErrorMessage('');
  }

  async function handleDelete(id: string) {
    if (!confirm('Apakah Anda yakin ingin menghapus data absensi ini?')) return;

    try {
      const response = await apiFetch(`/api/teacher/attendance/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSuccessMessage('Absensi berhasil dihapus');
        void fetchAttendances();
      } else {
        setErrorMessage('Gagal menghapus absensi');
      }
    } catch (error) {
      devError('Error deleting:', error);
      setErrorMessage('Terjadi kesalahan');
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HADIR':
        return 'bg-green-100 text-green-800';
      case 'SAKIT':
        return 'bg-yellow-100 text-yellow-800';
      case 'IZIN':
        return 'bg-blue-100 text-blue-800';
      case 'ALFA':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!selectedClassId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Absensi Siswa</h1>
          <p className="text-gray-600 mt-1">Pilih kelas untuk mengelola absensi</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Memuat data kelas...</p>
          </div>
        ) : classes.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <p className="text-yellow-800">
              📌 Anda belum ditugaskan sebagai Wali Kelas di kelas manapun.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((classItem) => (
              <div
                key={classItem.id}
                onClick={() => {
                  setSelectedClassId(classItem.id);
                  setSelectedClassName(classItem.name);
                  setCurrentPage(1);
                  setSearchTerm('');
                }}
                className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-all cursor-pointer border-l-4 border-emerald-500 p-6 group"
              >
                <h3 className="text-xl font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                  {classItem.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {classItem.levelName}
                </p>
                <p className="text-xs text-gray-400 mt-2">{normalizeSchoolYear(classItem.schoolYear)}</p>
                <div className="mt-4 text-emerald-600 group-hover:translate-x-1 transition-transform">
                  Klik untuk kelola absensi →
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Attendance Management View */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              router.push('/wali-kelas/classes');
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Kembali ke Daftar Kelas"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Absensi - {selectedClassName}
            </h1>
            <p className="text-gray-600 mt-1">Kelola absensi siswa di kelas ini</p>
          </div>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData({
              studentId: '',
              date: new Date().toISOString().split('T')[0],
              status: 'HADIR',
              notes: '',
            });
          }}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center gap-2 transition-colors"
        >
          <Plus size={20} /> Tambah Absensi
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle size={20} />
          {successMessage}
          <button
            onClick={() => setSuccessMessage('')}
            className="ml-auto text-green-700 hover:text-green-900"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {errorMessage}
          <button
            onClick={() => setErrorMessage('')}
            className="ml-auto text-red-700 hover:text-red-900"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-emerald-50 rounded-lg shadow-lg p-6 border-l-4 border-emerald-500">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? '✏️ Edit Absensi' : '➕ Tambah Absensi'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Siswa <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  required
                >
                  <option value="">-- Pilih Siswa --</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Tanggal <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as FormData['status'] })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  required
                >
                  <option value="HADIR">Hadir</option>
                  <option value="SAKIT">Sakit</option>
                  <option value="IZIN">Izin</option>
                  <option value="ALFA">Alfa</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Catatan
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  placeholder="Contoh: Sakit demam, Izin keluarga"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                {editingId ? 'Perbarui' : 'Tambahkan'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setErrorMessage('');
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Cari nama siswa..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nama Siswa</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tanggal</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Catatan</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Memuat data absensi...
                </td>
              </tr>
            ) : attendances.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Tidak ada data absensi ditemukan
                </td>
              </tr>
            ) : (
              attendances.map((record) => (
                <tr key={record.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{record.studentName || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {new Date(record.date).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(record.status)}`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{record.notes || '-'}</td>
                  <td className="px-6 py-4 text-center space-x-2">
                    <button
                      onClick={() => handleEdit(record)}
                      className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
                      title="Edit"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="text-red-600 hover:text-red-900 inline-flex items-center gap-1"
                      title="Hapus"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-6">
          <div className="text-sm text-gray-600">
            Halaman {currentPage} dari {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
