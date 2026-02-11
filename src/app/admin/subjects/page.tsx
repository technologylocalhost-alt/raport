'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Search, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';

interface Subject {
  id: string;
  code: string;
  name: string;
  description?: string;
  creditHours?: number;
  level: {
    id: string;
    name: string;
  };
}

interface PaginatedResponse {
  success: boolean;
  data: Subject[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface Level {
  id: string;
  name: string;
}

export default function SubjectsPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    levelId: '',
    code: '',
    name: '',
    description: '',
    creditHours: '',
  });

  const limit = 10;

  useEffect(() => {
    fetchLevels();
    fetchSubjects();
  }, [page, search]);

  async function fetchLevels() {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/admin/levels?limit=100', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: PaginatedResponse = await response.json();
      setLevels(data.data || []);
    } catch (error) {
      console.error('Failed to fetch levels:', error);
    }
  }

  async function fetchSubjects() {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
      });

      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/subjects?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: PaginatedResponse = await response.json();
      setSubjects(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to fetch subjects:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Validation
    if (!formData.levelId.trim() || !formData.code.trim() || !formData.name.trim()) {
      alert('Jenjang, Kode, dan Nama Mata Pelajaran wajib diisi!');
      return;
    }
    
    try {
      const token = localStorage.getItem('accessToken');
      const url = editingId ? `/api/admin/subjects/${editingId}` : '/api/admin/subjects';

      const submitData = {
        ...formData,
        creditHours: formData.creditHours ? parseInt(formData.creditHours) : undefined,
      };

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        alert(editingId ? '✅ Mata pelajaran berhasil diperbarui!' : '✅ Mata pelajaran berhasil ditambahkan!');
        setShowForm(false);
        setEditingId(null);
        setFormData({
          levelId: '',
          code: '',
          name: '',
          description: '',
          creditHours: '',
        });
        fetchSubjects();
      } else {
        const errorData = await response.json();
        let errorMsg = 'Gagal menyimpan mata pelajaran';
        if (errorData.error) {
          errorMsg = errorData.error;
        } else if (errorData.details && Array.isArray(errorData.details)) {
          errorMsg = errorData.details.map((d: any) => d.message || d).join(', ');
        }
        alert(`❌ ${errorMsg}`);
        console.error('Save error:', errorData);
      }
    } catch (error) {
      console.error('Failed to save subject:', error);
      alert('❌ Gagal menyimpan mata pelajaran. Silakan coba lagi.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this subject?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/subjects/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchSubjects();
      }
    } catch (error) {
      console.error('Failed to delete subject:', error);
    }
  }

  function handleEdit(subject: Subject) {
    setFormData({
      levelId: subject.level.id,
      code: subject.code,
      name: subject.name,
      description: subject.description || '',
      creditHours: subject.creditHours?.toString() || '',
    });
    setEditingId(subject.id);
    setShowForm(true);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manajemen Mata Pelajaran</h1>
          <p className="text-gray-600 text-sm mt-1">Kelola kurikulum dan kompetensi</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({
              levelId: '',
              code: '',
              name: '',
              description: '',
              creditHours: '',
            });
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors shadow-lg hover:shadow-xl font-medium"
        >
          <Plus size={20} />
          Tambah Mata Pelajaran
        </button>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Cari mata pelajaran..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg text-gray-900 font-medium placeholder:text-gray-600 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
          />
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-orange-500">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            {editingId ? '✏️ Edit Mata Pelajaran' : '➕ Tambah Mata Pelajaran Baru'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="border-t pt-4">
              {/* Row 1: Level */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Jenjang <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.levelId}
                  onChange={(e) => setFormData({ ...formData, levelId: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                >
                  <option value="" className="text-gray-500">Pilih Jenjang...</option>
                  {levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Row 2: Code & Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Kode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Masukkan kode mata pelajaran (mis: MTK, BIN, IPA)"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base placeholder:text-gray-500 placeholder:font-normal focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-gray-300 focus:outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nama Mata Pelajaran <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Masukkan nama mata pelajaran (mis: Matematika, Bahasa Indonesia)"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base placeholder:text-gray-500 placeholder:font-normal focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-gray-300 focus:outline-none transition-all"
                    required
                  />
                </div>
              </div>
              
              {/* Row 3: Credit Hours */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Jam Kredit
                </label>
                <input
                  type="number"
                  placeholder="Masukkan jumlah jam kredit (opsional)"
                  value={formData.creditHours}
                  onChange={(e) => setFormData({ ...formData, creditHours: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base placeholder:text-gray-500 placeholder:font-normal focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-gray-300 focus:outline-none transition-all"
                  min="0"
                />
              </div>
              
              {/* Row 4: Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Deskripsi
                </label>
                <textarea
                  placeholder="Masukkan deskripsi mata pelajaran (opsional)"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base placeholder:text-gray-500 placeholder:font-normal focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-gray-300 focus:outline-none transition-all resize-none"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors font-medium shadow-lg"
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
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
          </div>
        ) : subjects.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="mx-auto mb-4 text-orange-300" size={48} />
            <p className="text-gray-600 font-medium">Belum ada mata pelajaran yang didaftarkan</p>
            <p className="text-gray-500 text-sm mt-1">Mulai dengan menambah mata pelajaran baru</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Nama Mata Pelajaran
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Kode
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Jenjang
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Jam Kredit
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
                {subjects.map((subject) => (
                  <tr key={subject.id} className="hover:bg-orange-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {subject.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{subject.code}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{subject.level.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{subject.creditHours || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate">
                      {subject.description}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleEdit(subject)}
                        className="bg-blue-100 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-50 transition-all font-medium text-sm inline-flex items-center gap-1"
                      >
                        <Edit size={16} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(subject.id)}
                        className="bg-red-100 text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-all font-medium text-sm inline-flex items-center gap-1"
                      >
                        <Trash2 size={16} />
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
              <span className="text-sm text-gray-900 font-semibold">
                Halaman <span className="text-orange-600 font-bold">{page}</span> dari {totalPages} ({total} total)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-900 font-bold hover:bg-gray-100 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={16} />
                  Sebelumnya
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-900 font-bold hover:bg-gray-100 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
