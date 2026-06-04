'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Search, ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { devError } from '@/lib/dev-log';

interface Level {
  id: string;
  name: string;
  code: string;
  order: number;
  levelCount: number;
  description?: string;
  school: {
    id: string;
    name: string;
  };
  _count?: {
    subjects: number;
    classes: number;
  };
}

interface LevelsResponse {
  data?: Level[];
  pagination?: { total?: number };
}

interface SchoolsResponse {
  data?: School[];
}

interface ValidationErrorDetail {
  message?: string;
}

interface School {
  id: string;
  name: string;
}

export default function LevelsPage() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    schoolId: '',
    name: '',
    code: '',
    order: 0,
    levelCount: 0,
    description: '',
  });

  const limit = 10;

  const fetchSchools = useCallback(async () => {
    try {
      const response = await apiFetch('/api/admin/schools?limit=100');

      const data: SchoolsResponse = await response.json();
      setSchools(data.data || []);
    } catch (error) {
      devError('Failed to fetch schools:', error);
    }
  }, []);

  const fetchLevels = useCallback(async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
      });

      const response = await apiFetch(`/api/admin/levels?${queryParams}`);

      const data: LevelsResponse = await response.json();
      setLevels(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      devError('Failed to fetch levels:', error);
    } finally {
      setIsLoading(false);
    }
  }, [limit, page, search]);

  useEffect(() => {
    void fetchSchools();
    void fetchLevels();
  }, [fetchLevels, fetchSchools]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Validation
    if (!formData.schoolId.trim() || !formData.name.trim() || !formData.code.trim()) {
      alert('Sekolah, Nama Jenjang, dan Kode wajib diisi!');
      return;
    }
    
    try {
      const url = editingId ? `/api/admin/levels/${editingId}` : '/api/admin/levels';

      const response = await apiFetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert(editingId ? '✅ Jenjang berhasil diperbarui!' : '✅ Jenjang berhasil ditambahkan!');
        setShowForm(false);
        setEditingId(null);
        setFormData({
          schoolId: '',
          name: '',
          code: '',
          order: 0,
          levelCount: 0,
          description: '',
        });
        void fetchLevels();
      } else {
        let errorMsg = 'Gagal menyimpan jenjang';
        try {
          const contentType = response.headers.get('content-type');
          const errorData = contentType?.includes('application/json') 
            ? await response.json() 
            : { error: await response.text() };
          
          if (errorData.error) {
            errorMsg = errorData.error;
          } else if (errorData.details && Array.isArray(errorData.details)) {
            errorMsg = (errorData.details as ValidationErrorDetail[]).map((d) => d.message || JSON.stringify(d)).join(', ');
          }
          devError('API Error Response:', { status: response.status, data: errorData });
        } catch (parseError) {
          devError('Failed to parse error response:', { 
            status: response.status, 
            statusText: response.statusText,
            parseError 
          });
          errorMsg = `Gagal menyimpan jenjang (Status: ${response.status} ${response.statusText})`;
        }
        alert(`❌ ${errorMsg}`);
      }
    } catch (error) {
      devError('Failed to save level:', error);
      alert('❌ Gagal menyimpan jenjang. Silakan coba lagi.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this level?')) return;

    try {
      const response = await apiFetch(`/api/admin/levels/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        void fetchLevels();
      }
    } catch (error) {
      devError('Failed to delete level:', error);
    }
  }

  function handleEdit(level: Level) {
    setFormData({
      schoolId: level.school.id,
      name: level.name,
      code: level.code,
      order: level.order ?? 0,
      levelCount: level.levelCount ?? 0,
      description: level.description || '',
    });
    setEditingId(level.id);
    setShowForm(true);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manajemen Jenjang Pendidikan</h1>
          <p className="text-gray-600 text-sm mt-1">Kelola SD, SMP, SMA, dan Aliyah</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({
              schoolId: '',
              name: '',
              code: '',
              order: 0,
              levelCount: 0,
              description: '',
            });
            setShowForm(true);
          }}
          className="flex items-center justify-center sm:justify-start gap-2 bg-purple-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-purple-700 transition-colors shadow-lg hover:shadow-xl font-medium whitespace-nowrap"
        >
          <Plus size={20} />
          <span className="hidden xs:hidden sm:inline">Tambah Jenjang</span>
          <span className="inline sm:hidden">Tambah</span>
        </button>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Cari jenjang pendidikan..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-900"
          />
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-purple-500">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            {editingId ? '✏️ Edit Jenjang' : '➕ Tambah Jenjang Baru'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="border-t pt-4">
              {/* Row 1: School */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sekolah <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.schoolId}
                  onChange={(e) => setFormData({ ...formData, schoolId: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base focus:ring-2 focus:ring-purple-500 focus:border-purple-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                >
                  <option value="" className="text-gray-500">Pilih Sekolah...</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Row 2: Name & Code */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nama Jenjang <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Masukkan nama jenjang (SMA, SMK, SMP, SD)"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base placeholder:text-gray-500 placeholder:font-normal focus:ring-2 focus:ring-purple-500 focus:border-purple-500 hover:border-gray-300 focus:outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Kode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Masukkan kode (mis: SMA, SMK, SMP)"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base placeholder:text-gray-500 placeholder:font-normal focus:ring-2 focus:ring-purple-500 focus:border-purple-500 hover:border-gray-300 focus:outline-none transition-all"
                    required
                  />
                </div>
              </div>

              {/* Row 2b: Order & Level Count */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Urutan Level <span className="text-gray-400 font-normal">(untuk sistem naik kelas)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Mis: 1 untuk kelas paling awal, 2 berikutnya, dst."
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base placeholder:text-gray-500 placeholder:font-normal focus:ring-2 focus:ring-purple-500 focus:border-purple-500 hover:border-gray-300 focus:outline-none transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-1">Contoh: Kelas 1 = 1, Kelas 2 = 2, Kelas 3 = 3</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Jumlah Tingkat <span className="text-gray-400 font-normal">(dalam jenjang ini)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Mis: 6 untuk MI, 3 untuk MTS/MA"
                    value={formData.levelCount}
                    onChange={(e) => setFormData({ ...formData, levelCount: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base placeholder:text-gray-500 placeholder:font-normal focus:ring-2 focus:ring-purple-500 focus:border-purple-500 hover:border-gray-300 focus:outline-none transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-1">Berapa banyak tingkat dalam jenjang ini</p>
                </div>
              </div>
              
              {/* Row 3: Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Deskripsi
                </label>
                <textarea
                  placeholder="Masukkan deskripsi jenjang (opsional)"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base placeholder:text-gray-500 placeholder:font-normal focus:ring-2 focus:ring-purple-500 focus:border-purple-500 hover:border-gray-300 focus:outline-none transition-all resize-none"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-lg"
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Memuat data...</p>
          </div>
        ) : levels.length === 0 ? (
          <div className="p-12 text-center">
            <GraduationCap size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 font-medium">Tidak ada data jenjang</p>
            <p className="text-gray-500 text-sm mt-1">Silakan klik tombol &quot;Tambah Jenjang&quot; untuk membuat data baru</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Nama Jenjang
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Kode
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                      Urutan
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                      Jumlah Tingkat
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Sekolah
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Deskripsi
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                      Aksi
                    </th>
                  </tr>
                </thead>
              <tbody className="divide-y">
                {levels.map((level) => (
                  <tr key={level.id} className="hover:bg-purple-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {level.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{level.code}</td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold text-sm">
                        {level.order ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                        {level.levelCount ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{level.school.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate">
                      {level.description}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleEdit(level)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-lg transition-all inline-flex items-center gap-1 font-medium"
                      >
                        <Edit size={16} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(level.id)}
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
                Halaman <span className="font-bold text-purple-600">{page}</span> dari{' '}
                <span className="font-bold text-purple-600">{totalPages}</span> ({total} total)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors font-medium text-gray-900"
                >
                  <ChevronLeft size={16} />
                  Sebelumnya
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors font-medium text-gray-900"
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
