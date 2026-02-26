'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Search, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';

interface School {
  id: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  npsn?: string;
  _count?: {
    levels: number;
    users: number;
  };
}

interface PaginatedResponse {
  success: boolean;
  data: School[];
  page: number;
  limit: number;
  total: number;
}

export default function SchoolsPage() {
  const router = useRouter();
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    npsn: '',
  });

  const limit = 10;

  useEffect(() => {
    fetchSchools();
  }, [page, search]);

  async function fetchSchools() {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
      });

      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/schools?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: PaginatedResponse = await response.json();
      setSchools(data.data || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch schools:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name || !formData.address) {
      alert('Nama Sekolah dan Alamat tidak boleh kosong!');
      return;
    }

    // Validate email format if provided
    if (formData.email && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      alert('Email yang dimasukkan tidak valid!');
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        alert('❌ Token tidak ditemukan. Silakan login terlebih dahulu.');
        return;
      }

      const url = editingId
        ? `/api/admin/schools/${editingId}`
        : '/api/admin/schools';

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      console.log(`[${editingId ? 'UPDATE' : 'CREATE'}] Response status:`, response.status);

      if (!response.ok) {
        console.log('Response is not ok, attempting to parse error...');
      }

      const result = await response.json();
      console.log('API Response:', result);

      if (response.ok) {
        alert(editingId ? '✅ Sekolah berhasil diperbarui!' : '✅ Sekolah berhasil ditambahkan!');
        setShowForm(false);
        setEditingId(null);
        setFormData({
          name: '',
          address: '',
          phone: '',
          email: '',
          npsn: '',
        });
        fetchSchools();
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
      console.error('Failed to save school:', error);
      alert(`❌ Gagal menyimpan data. Silakan coba lagi.\n${error instanceof Error ? error.message : ''}`);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this school?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/schools/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchSchools();
      }
    } catch (error) {
      console.error('Failed to delete school:', error);
    }
  }

  function handleEdit(school: School) {
    setFormData({
      name: school.name,
      address: school.address,
      phone: school.phone || '',
      email: school.email || '',
      npsn: school.npsn || '',
    });
    setEditingId(school.id);
    setShowForm(true);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manajemen Sekolah</h1>
          <p className="text-gray-600 text-sm mt-1">Kelola informasi sekolah Anda</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({
              name: '',
              address: '',
              phone: '',
              email: '',
              npsn: '',
            });
            setShowForm(true);
          }}
          className="flex items-center justify-center sm:justify-start gap-2 bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl font-medium whitespace-nowrap"
        >
          <Plus size={20} />
          <span className="hidden xs:hidden sm:inline">Tambah Sekolah</span>
          <span className="inline sm:hidden">Tambah</span>
        </button>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Cari sekolah berdasarkan nama, email, atau NPSN..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 text-sm sm:text-base"
          />
        </div>
      </div>

      {/* Form Section */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 border-l-4 border-blue-500">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">
            {editingId ? '✏️ Edit Sekolah' : '➕ Tambah Sekolah Baru'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Row 1: Nama Sekolah dan NPSN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nama Sekolah <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Masukkan nama sekolah"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-sm sm:text-base placeholder:text-gray-500 placeholder:font-normal focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  NPSN
                </label>
                <input
                  type="text"
                  placeholder="Masukkan NPSN"
                  value={formData.npsn}
                  onChange={(e) => setFormData({ ...formData, npsn: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-sm sm:text-base placeholder:text-gray-500 placeholder:font-normal focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Row 2: Email dan Telepon */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="Masukkan email sekolah"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-sm sm:text-base placeholder:text-gray-500 placeholder:font-normal focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Telepon
                </label>
                <input
                  type="tel"
                  placeholder="Masukkan nomor telepon"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-sm sm:text-base placeholder:text-gray-500 placeholder:font-normal focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Row 3: Alamat */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Alamat <span className="text-red-500">*</span>
              </label>
              <textarea
                placeholder="Masukkan alamat lengkap sekolah"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-sm sm:text-base placeholder:text-gray-500 placeholder:font-normal focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all resize-none"
                rows={3}
                required
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg hover:shadow-xl text-sm sm:text-base"
              >
                Simpan
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-200 text-gray-700 px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm sm:text-base"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-6 sm:p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-sm sm:text-base">Memuat data...</p>
          </div>
        ) : schools.length === 0 ? (
          <div className="p-6 sm:p-12 text-center">
            <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 font-medium text-sm sm:text-base">Tidak ada data sekolah</p>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">Silakan klik tombol "Tambah Sekolah" untuk membuat data baru</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                    <th className="px-3 sm:px-6 py-2 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">Nama Sekolah</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">NPSN</th>
                    <th className="hidden md:table-cell px-3 sm:px-6 py-2 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">Email</th>
                    <th className="hidden lg:table-cell px-3 sm:px-6 py-2 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">Telepon</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-4 text-right text-xs sm:text-sm font-semibold text-gray-700">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {schools.map((school) => (
                    <tr key={school.id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm font-semibold text-gray-900">{school.name}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-600">{school.npsn || '-'}</td>
                      <td className="hidden md:table-cell px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-600 truncate">{school.email || '-'}</td>
                      <td className="hidden lg:table-cell px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-600">{school.phone || '-'}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-right space-x-1 sm:space-x-2">
                        <button
                          onClick={() => handleEdit(school)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 sm:px-3 py-1 sm:py-2 rounded-lg transition-all inline-flex items-center gap-1 font-medium text-xs sm:text-sm"
                        >
                          <Edit size={14} className="sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(school.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 sm:px-3 py-1 sm:py-2 rounded-lg transition-all inline-flex items-center gap-1 font-medium text-xs sm:text-sm"
                        >
                          <Trash2 size={14} className="sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">Hapus</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-t bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-xs sm:text-sm text-gray-700 font-medium">
                Halaman <span className="font-bold text-blue-600">{page}</span> dari{' '}
                <span className="font-bold text-blue-600">{totalPages}</span> ({total} total)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 sm:px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors font-medium text-xs sm:text-sm"
                >
                  <ChevronLeft size={16} />
                  <span className="hidden sm:inline">Sebelumnya</span>
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 sm:px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors font-medium text-xs sm:text-sm"
                >
                  <span className="hidden sm:inline">Selanjutnya</span>
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
