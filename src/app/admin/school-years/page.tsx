'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface SchoolYear {
  id: string;
  year: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  school: {
    id: string;
    name: string;
  };
}

interface PaginatedResponse {
  success: boolean;
  data: SchoolYear[];
  page?: number;
  limit?: number;
  total?: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface SchoolsResponse {
  success: boolean;
  data: School[];
}

interface School {
  id: string;
  name: string;
}

export default function SchoolYearsPage() {
  const router = useRouter();
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    schoolId: '',
    year: '',
    startDate: '',
    endDate: '',
    isActive: false,
  });

  const limit = 10;

  useEffect(() => {
    fetchSchools();
    fetchSchoolYears();
  }, [page]);

  async function fetchSchools() {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/admin/schools?limit=100', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: SchoolsResponse = await response.json();
      setSchools(data.data || []);
    } catch (error) {
      console.error('Failed to fetch schools:', error);
    }
  }

  async function fetchSchoolYears() {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/school-years?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: PaginatedResponse = await response.json();
      setSchoolYears(data.data || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch school years:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.schoolId || !formData.year || !formData.startDate || !formData.endDate) {
      alert('Semua field wajib diisi!');
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const url = editingId
        ? `/api/admin/school-years/${editingId}`
        : '/api/admin/school-years';

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          startDate: new Date(formData.startDate).toISOString(),
          endDate: new Date(formData.endDate).toISOString(),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(editingId ? '✅ Tahun Ajaran berhasil diperbarui!' : '✅ Tahun Ajaran berhasil ditambahkan!');
        setShowForm(false);
        setEditingId(null);
        setFormData({
          schoolId: '',
          year: '',
          startDate: '',
          endDate: '',
          isActive: false,
        });
        fetchSchoolYears();
      } else {
        // Handle different error types
        let errorMsg = 'Gagal menyimpan data';
        if (result.error) {
          errorMsg = result.error;
        } else if (result.details && Array.isArray(result.details)) {
          errorMsg = result.details.map((d: any) => d.message || d).join(', ');
        }
        alert(`❌ ${errorMsg}`);
        console.error('Save error:', result);
      }
    } catch (error) {
      alert('❌ Gagal menyimpan data. Silakan coba lagi.');
      console.error('Failed to save school year:', error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this school year?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/school-years/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchSchoolYears();
      }
    } catch (error) {
      console.error('Failed to delete school year:', error);
    }
  }

  function handleEdit(schoolYear: SchoolYear) {
    setFormData({
      schoolId: schoolYear.school.id,
      year: schoolYear.year,
      startDate: schoolYear.startDate.split('T')[0],
      endDate: schoolYear.endDate.split('T')[0],
      isActive: schoolYear.isActive,
    });
    setEditingId(schoolYear.id);
    setShowForm(true);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manajemen Tahun Ajaran</h1>
          <p className="text-gray-600 text-sm mt-1">Kelola tahun ajaran dan semester</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({
              schoolId: '',
              year: '',
              startDate: '',
              endDate: '',
              isActive: false,
            });
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors shadow-lg hover:shadow-xl font-medium"
        >
          <Plus size={20} />
          Tambah Tahun Ajaran
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-500">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            {editingId ? '✏️ Edit Tahun Ajaran' : '➕ Tambah Tahun Ajaran Baru'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Row 1: Sekolah dan Tahun */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sekolah <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.schoolId}
                  onChange={(e) => setFormData({ ...formData, schoolId: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base focus:ring-2 focus:ring-green-500 focus:border-green-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                >
                  <option value="" className="text-gray-500">-- Pilih Sekolah --</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tahun Ajaran <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 2024/2025"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base placeholder:text-gray-500 placeholder:font-normal focus:ring-2 focus:ring-green-500 focus:border-green-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                  pattern="\d{4}/\d{4}"
                />
              </div>
            </div>

            {/* Row 2: Tanggal Mulai dan Tanggal Berakhir */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tanggal Mulai <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base focus:ring-2 focus:ring-green-500 focus:border-green-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tanggal Berakhir <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base focus:ring-2 focus:ring-green-500 focus:border-green-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Active Status */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-5 h-5 rounded accent-green-600 cursor-pointer"
                />
                <span className="font-medium text-gray-900">Tahun Ajaran Aktif (Tahun ajaran yang sedang berjalan)</span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                type="submit"
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-lg hover:shadow-xl"
              >
                Simpan
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Memuat data...</p>
          </div>
        ) : schoolYears.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 font-medium">Tidak ada data tahun ajaran</p>
            <p className="text-gray-500 text-sm mt-1">Silakan klik tombol "Tambah Tahun Ajaran" untuk membuat data baru</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Sekolah</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Tahun</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Tanggal Mulai</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Tanggal Akhir</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {schoolYears.map((schoolYear) => (
                    <tr key={schoolYear.id} className="hover:bg-green-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {schoolYear.school.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{schoolYear.year}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(schoolYear.startDate).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(schoolYear.endDate).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-lg text-xs font-bold ${
                            schoolYear.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {schoolYear.isActive ? '✓ Aktif' : '○ Tidak Aktif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handleEdit(schoolYear)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-lg transition-all inline-flex items-center gap-1 font-medium"
                        >
                          <Edit size={16} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(schoolYear.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-all inline-flex items-center gap-1 font-medium"
                        >
                          <Trash2 size={16} />
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
              <span className="text-sm text-gray-700 font-medium">
                Halaman <span className="font-bold text-green-600">{page}</span> dari{' '}
                <span className="font-bold text-green-600">{totalPages}</span> ({total} total)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors font-medium"
                >
                  <ChevronLeft size={16} />
                  Sebelumnya
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors font-medium"
                >
                  Selanjutnya
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
