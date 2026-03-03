'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface SchoolYear {
  id: string;
  year: string;
}

interface SemesterData {
  id: string;
  number: number;
  schoolYearId: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  schoolYear: SchoolYear;
  _count: {
    classes: number;
  };
}

interface PaginatedResponse {
  success: boolean;
  data: SemesterData[];
  page: number;
  limit: number;
  total: number;
}

export default function SemestersPage() {
  const [semesters, setSemesters] = useState<SemesterData[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterSchoolYear, setFilterSchoolYear] = useState('');
  const [formData, setFormData] = useState({
    schoolYearId: '',
    number: 1,
    startDate: '',
    endDate: '',
    isActive: true,
  });

  const limit = 10;

  useEffect(() => {
    fetchSchoolYears();
  }, []);

  useEffect(() => {
    fetchSemesters();
  }, [page, filterSchoolYear]);

  async function fetchSchoolYears() {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/admin/school-years?limit=100', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      setSchoolYears(data.data || []);
    } catch (error) {
      console.error('Failed to fetch school years:', error);
    }
  }

  async function fetchSemesters() {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filterSchoolYear && { schoolYearId: filterSchoolYear }),
      });

      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/semesters?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: any = await response.json();
      setSemesters(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to fetch semesters:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.schoolYearId || !formData.startDate || !formData.endDate) {
      alert('Tahun akademik, tanggal mulai, dan tanggal selesai harus diisi!');
      return;
    }

    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);

    if (startDate >= endDate) {
      alert('Tanggal mulai harus lebih awal dari tanggal selesai!');
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        alert('❌ Token tidak ditemukan. Silakan login terlebih dahulu.');
        return;
      }

      const url = editingId ? `/api/admin/semesters/${editingId}` : '/api/admin/semesters';

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        alert(editingId ? '✅ Semester berhasil diperbarui!' : '✅ Semester berhasil ditambahkan!');
        setShowForm(false);
        setEditingId(null);
        setFormData({
          schoolYearId: '',
          number: 1,
          startDate: '',
          endDate: '',
          isActive: true,
        });
        fetchSemesters();
      } else {
        let errorMsg = 'Gagal menyimpan data';
        if (result.error) {
          errorMsg = result.error;
        }
        alert(`❌ ${errorMsg}`);
      }
    } catch (error) {
      console.error('Failed to save semester:', error);
      alert('❌ Gagal menyimpan data. Silakan coba lagi.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Apakah Anda yakin ingin menghapus semester ini?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/semesters/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert('✅ Semester berhasil dihapus!');
        fetchSemesters();
      } else {
        const result = await response.json();
        alert(`❌ ${result.error || 'Gagal menghapus semester'}`);
      }
    } catch (error) {
      console.error('Failed to delete semester:', error);
      alert('❌ Gagal menghapus semester');
    }
  }

  function handleEdit(semester: SemesterData) {
    setFormData({
      schoolYearId: semester.schoolYearId,
      number: semester.number,
      startDate: semester.startDate.split('T')[0],
      endDate: semester.endDate.split('T')[0],
      isActive: semester.isActive,
    });
    setEditingId(semester.id);
    setShowForm(true);
  }

  const totalPages = Math.ceil(total / limit);

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manajemen Semester</h1>
          <p className="text-gray-600 text-sm mt-1">Kelola semester setiap tahun akademik</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({
              schoolYearId: '',
              number: 1,
              startDate: '',
              endDate: '',
              isActive: true,
            });
            setShowForm(true);
          }}
          className="flex items-center justify-center sm:justify-start gap-2 bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl font-medium whitespace-nowrap"
        >
          <Plus size={20} />
          <span className="hidden xs:hidden sm:inline">Tambah Semester</span>
          <span className="inline sm:hidden">Tambah</span>
        </button>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-lg shadow p-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Filter Tahun Akademik
          </label>
          <select
            value={filterSchoolYear}
            onChange={(e) => {
              setFilterSchoolYear(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="">-- Semua Tahun Akademik --</option>
            {schoolYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Form Section */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            {editingId ? '✏️ Edit Semester' : '➕ Tambah Semester Baru'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tahun Akademik <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.schoolYearId}
                  onChange={(e) => setFormData({ ...formData, schoolYearId: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                >
                  <option value="">-- Pilih Tahun Akademik --</option>
                  {schoolYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nomor Semester <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                >
                  <option value={1}>Semester 1</option>
                  <option value={2}>Semester 2</option>
                </select>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tanggal Mulai <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tanggal Selesai <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-gray-700">Aktif</span>
              </label>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-6">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                {editingId ? 'Simpan Perubahan' : 'Tambah Semester'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({
                    schoolYearId: '',
                    number: 1,
                    startDate: '',
                    endDate: '',
                    isActive: true,
                  });
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-400 transition-colors font-medium"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Tahun Akademik</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Semester</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Tanggal Mulai</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Tanggal Selesai</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Kelas</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : semesters.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  Tidak ada semester ditemukan
                </td>
              </tr>
            ) : (
              semesters.map((semester) => (
                <tr key={semester.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                    {semester.schoolYear.year}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                    Semester {semester.number}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDate(semester.startDate)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDate(semester.endDate)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {semester.isActive ? (
                      <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        Aktif
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                        Nonaktif
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                      {semester._count.classes} kelas
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleEdit(semester)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(semester.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hapus"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-900 font-medium"
          >
            <ChevronLeft size={20} />
            Sebelumnya
          </button>
          <span className="text-sm text-gray-600">
            Halaman {page} dari {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-900 font-medium"
          >
            Selanjutnya
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
