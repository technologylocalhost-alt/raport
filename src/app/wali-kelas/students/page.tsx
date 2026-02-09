'use client';

import { useEffect, useState, FormEvent, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Search, ChevronLeft, ChevronRight, X, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

interface Class {
  id: string;
  name: string;
  levelId: string;
  levelName?: string;
  semesterId: string;
  semesterName?: string;
  capacity: number;
  _count?: {
    students?: number;
  };
}

interface Student {
  id: string;
  studentNo: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  birthDate?: string;
  parentPhoneNo?: string;
  classId: string;
}

interface FormData {
  studentNo: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  birthDate: string;
  parentPhoneNo: string;
}

export default function WaliKelasStudentsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <StudentsPageContent />
    </Suspense>
  );
}

function StudentsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [userSchoolId, setUserSchoolId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedClassName, setSelectedClassName] = useState<string>('');

  const [formData, setFormData] = useState<FormData>({
    studentNo: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    birthDate: '',
    parentPhoneNo: '',
  });

  const itemsPerPage = 10;

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      const parsedUser = JSON.parse(user);
      setUserSchoolId(parsedUser.schoolId);
      setUserId(parsedUser.id);
      
      // Check if classId is in URL params
      const classIdParam = searchParams.get('classId');
      if (classIdParam) {
        setSelectedClassId(classIdParam);
        fetchClassNameAndStudents(classIdParam);
      } else {
        fetchClasses(parsedUser.id);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedClassId) {
      fetchStudents();
    }
  }, [selectedClassId, currentPage, searchTerm]);

  async function fetchClassNameAndStudents(classId: string) {
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch class details to get the name
      const classResponse = await fetch(`/api/admin/classes/${classId}`, { headers });
      const classData = await classResponse.json();

      if (classResponse.ok && classData.data) {
        setSelectedClassName(classData.data.name);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching class name:', error);
      setErrorMessage('Gagal memuat data');
      setIsLoading(false);
    }
  }

  async function fetchClasses(waliKelasId: string) {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };

      const response = await fetch(`/api/admin/classes?limit=100&waliKelasId=${waliKelasId}`, { headers });
      const data = await response.json();

      if (response.ok) {
        // Transform classes to extract nested object values
        const transformedClasses = (data.data || []).map((c: any) => ({
          ...c,
          levelName: c.level?.name || '-',
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

  async function fetchStudents() {
    if (!selectedClassId) return;

    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };

      const skip = (currentPage - 1) * itemsPerPage;
      const url = `/api/admin/classes/${selectedClassId}/students?limit=${itemsPerPage}&skip=${skip}${searchTerm ? `&search=${searchTerm}` : ''}`;

      const response = await fetch(url, { headers });
      const data = await response.json();

      if (response.ok) {
        setStudents(data.data || []);
        const total = data.meta?.total || 0;
        setTotalPages(Math.ceil(total / itemsPerPage));
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      setErrorMessage('Gagal memuat data siswa');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!formData.name || !formData.studentNo || !formData.email) {
      setErrorMessage('Nama, Nomor Siswa, dan Email harus diisi');
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      let url: string;
      let method: string;

      if (editingId) {
        // Edit: use /api/admin/classes/[id]/students endpoint
        url = `/api/admin/classes/${selectedClassId}/students`;
        method = 'POST';
      } else {
        // Create: use /api/admin/classes/[id]/students endpoint
        url = `/api/admin/classes/${selectedClassId}/students`;
        method = 'POST';
      }

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSuccessMessage(editingId ? 'Siswa berhasil diperbarui' : 'Siswa berhasil ditambahkan');
        setShowForm(false);
        setEditingId(null);
        setFormData({
          studentNo: '',
          name: '',
          email: '',
          phone: '',
          address: '',
          birthDate: '',
          parentPhoneNo: '',
        });
        setCurrentPage(1);
        fetchStudents();
      } else {
        const error = await response.json();
        setErrorMessage(error.error || 'Terjadi kesalahan');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setErrorMessage('Terjadi kesalahan saat menyimpan data');
    }
  }

  async function handleEdit(student: Student) {
    setEditingId(student.id);
    setFormData({
      studentNo: student.studentNo || '',
      name: student.name || '',
      email: student.email || '',
      phone: student.phone || '',
      address: student.address || '',
      birthDate: student.birthDate || '',
      parentPhoneNo: student.parentPhoneNo || '',
    });
    setShowForm(true);
    setErrorMessage('');
  }

  async function handleDelete(id: string) {
    if (!confirm('Apakah Anda yakin ingin menghapus siswa ini?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/students/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        setSuccessMessage('Siswa berhasil dihapus');
        fetchStudents();
      } else {
        setErrorMessage('Gagal menghapus siswa');
      }
    } catch (error) {
      console.error('Error deleting:', error);
      setErrorMessage('Terjadi kesalahan');
    }
  }

  const displayedStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.studentNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // View: Classes List
  if (!selectedClassId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Daftar Siswa Kelas</h1>
          <p className="text-gray-600 mt-1">Pilih kelas untuk melihat daftar siswa</p>
        </div>

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

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Memuat data kelas...</p>
          </div>
        ) : classes.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <p className="text-yellow-800">
              📌 Anda belum ditugaskan sebagai Wali Kelas di kelas manapun. 
              Silakan hubungi administrator untuk ditugaskan.
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
                className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-all cursor-pointer border-l-4 border-green-500 p-6 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                      {classItem.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {classItem.levelName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Siswa</p>
                      <p className="text-2xl font-bold text-green-600">
                        {classItem._count?.students || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Kapasitas</p>
                      <p className="text-2xl font-bold text-gray-700">
                        {classItem.capacity}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-green-600 group-hover:translate-x-1 transition-transform">
                  Klik untuk lihat siswa →
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // View: Students List (after selecting a class)
  return (
    <div className="space-y-6">
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
              Daftar Siswa - {selectedClassName}
            </h1>
            <p className="text-gray-600 mt-1">Kelola data siswa di kelas ini</p>
          </div>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData({
              studentNo: '',
              name: '',
              email: '',
              phone: '',
              address: '',
              birthDate: '',
              parentPhoneNo: '',
            });
          }}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
        >
          <Plus size={20} /> Tambah Siswa
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
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-500">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? '✏️ Edit Siswa' : '➕ Tambah Siswa'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Nomor Siswa <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="12345678901"
                  value={formData.studentNo}
                  onChange={(e) => setFormData({ ...formData, studentNo: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Masukkan nama siswa"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Telepon
                </label>
                <input
                  type="tel"
                  placeholder="0812345678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Tanggal Lahir
                </label>
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Nomor Telepon Orang Tua
                </label>
                <input
                  type="tel"
                  placeholder="0812345678"
                  value={formData.parentPhoneNo}
                  onChange={(e) => setFormData({ ...formData, parentPhoneNo: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Alamat
              </label>
              <textarea
                placeholder="Masukkan alamat lengkap siswa"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-3 bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
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
            placeholder="Cari nama atau NISN..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nomor Siswa</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nama Siswa</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Telepon</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Memuat data siswa...
                </td>
              </tr>
            ) : displayedStudents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Tidak ada data siswa ditemukan
                </td>
              </tr>
            ) : (
              displayedStudents.map((student) => (
                <tr key={student.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{student.studentNo}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{student.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{student.email || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{student.phone || '-'}</td>
                  <td className="px-6 py-4 text-center space-x-2">
                    <button
                      onClick={() => handleEdit(student)}
                      className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
                      title="Edit"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(student.id)}
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
