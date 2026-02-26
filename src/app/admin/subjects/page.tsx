'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Search, ChevronLeft, ChevronRight, BookOpen, Upload, X, Download } from 'lucide-react';

interface Subject {
  id: string;
  code: string;
  name: string;
  nameArabic?: string;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [formData, setFormData] = useState({
    levelId: '',
    code: '',
    name: '',
    nameArabic: '',
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
      if (!token) {
        console.warn('[fetchLevels] No token found');
        return;
      }

      const response = await fetch('/api/admin/levels?limit=100', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        console.warn('[fetchLevels] 401 Unauthorized - redirecting to login');
        window.location.href = '/login';
        return;
      }

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
      if (!token) {
        console.warn('[fetchSubjects] No token found');
        return;
      }

      const response = await fetch(`/api/admin/subjects?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        console.warn('[fetchSubjects] 401 Unauthorized - redirecting to login');
        window.location.href = '/login';
        return;
      }

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
          nameArabic: '',
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

  async function handleImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      alert('Silakan pilih file Excel');
      return;
    }

    try {
      let token = localStorage.getItem('accessToken');
      
      if (!token) {
        alert('❌ Token tidak ditemukan. Silakan login kembali.');
        return;
      }

      setIsImporting(true);
      const formData = new FormData();
      formData.append('file', file);

      console.log('[Import] Token exists, uploading file...');

      const response = await fetch('/api/admin/subjects/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      console.log('[Import] Response status:', response.status);

      if (response.status === 401) {
        setImportResult({
          success: false,
          error: 'Session expired. Silakan login kembali.',
        });
        // Redirect to login after 2 seconds
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        setImportResult({
          success: false,
          error: result.error || 'Gagal mengimpor file',
          details: result.details,
        });
        return;
      }

      setImportResult({
        success: true,
        message: result.message,
        data: result.data,
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh data after 2 seconds
      setTimeout(() => {
        fetchSubjects();
      }, 2000);
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        success: false,
        error: 'Terjadi kesalahan saat mengimpor',
      });
    } finally {
      setIsImporting(false);
    }
  }

  async function handleExport() {
    try {
      let token = localStorage.getItem('accessToken');
      
      if (!token) {
        alert('❌ Token tidak ditemukan. Silakan login kembali.');
        return;
      }

      console.log('[Export] Token exists:', token.substring(0, 20) + '...');

      const response = await fetch('/api/admin/subjects/export', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('[Export] Response status:', response.status);

      if (response.status === 401) {
        alert('❌ Session expired. Silakan login kembali.');
        // Redirect to login
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        alert(`❌ ${errorData.error || 'Gagal mengekspor file'}`);
        return;
      }

      // Get filename from header
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'mata-pelajaran-export.xlsx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert('✅ File berhasil diunduh!');
    } catch (error) {
      console.error('Export error:', error);
      alert('❌ Gagal mengekspor file');
    }
  }

  function handleEdit(subject: Subject) {
    setFormData({
      levelId: subject.level.id,
      code: subject.code,
      name: subject.name,
      nameArabic: subject.nameArabic || '',
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manajemen Mata Pelajaran</h1>
          <p className="text-gray-600 text-sm mt-1">Kelola kurikulum dan kompetensi</p>
        </div>
        <div className="flex flex-row flex-wrap gap-2 sm:gap-3 justify-end">
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl font-medium text-sm sm:text-base"
          >
            <Download size={20} />
            <span className="hidden sm:inline">Export Excel</span>
            <span className="inline sm:hidden">Export</span>
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center justify-center gap-2 bg-green-600 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-green-700 transition-colors shadow-lg hover:shadow-xl font-medium text-sm sm:text-base"
          >
            <Upload size={20} />
            <span className="hidden sm:inline">Import Excel</span>
            <span className="inline sm:hidden">Import</span>
          </button>
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({
                levelId: '',
                code: '',
                name: '',
                nameArabic: '',
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
              
              {/* Row 3: Arabic Name */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nama Mata Pelajaran (Arab)
                </label>
                <input
                  type="text"
                  placeholder="Masukkan nama mata pelajaran dalam bahasa arab (mis: الرياضيات, العلوم)"
                  value={formData.nameArabic}
                  onChange={(e) => setFormData({ ...formData, nameArabic: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base placeholder:text-gray-500 placeholder:font-normal focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-gray-300 focus:outline-none transition-all"
                />
              </div>
              
              {/* Row 4: Credit Hours */}
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b sticky top-0">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">
                      Nama Mata Pelajaran
                    </th>
                    <th className="hidden lg:table-cell px-3 sm:px-6 py-2 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">
                      Nama (Arab)
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">
                      Kode
                    </th>
                    <th className="hidden md:table-cell px-3 sm:px-6 py-2 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">
                      Jenjang
                    </th>
                    <th className="hidden lg:table-cell px-3 sm:px-6 py-2 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">
                      Jam Kredit
                    </th>
                    <th className="hidden xl:table-cell px-3 sm:px-6 py-2 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">
                      Deskripsi
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-4 text-right text-xs sm:text-sm font-semibold text-gray-700">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {subjects.map((subject) => (
                    <tr key={subject.id} className="hover:bg-orange-50 transition-colors">
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm font-medium text-gray-900">
                        <div className="flex flex-col gap-1">
                          <span>{subject.name}</span>
                          <span className="text-xs text-gray-500 lg:hidden">
                            {subject.nameArabic && `Arab: ${subject.nameArabic}`}
                          </span>
                        </div>
                      </td>
                      <td className="hidden lg:table-cell px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-600">
                        {subject.nameArabic || '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-600">{subject.code}</td>
                      <td className="hidden md:table-cell px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-600">{subject.level.name}</td>
                      <td className="hidden lg:table-cell px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-600">{subject.creditHours || '-'}</td>
                      <td className="hidden xl:table-cell px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-600 truncate">
                        {subject.description}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-right space-x-1 sm:space-x-2">
                        <button
                          onClick={() => handleEdit(subject)}
                          className="bg-blue-100 text-blue-700 px-2 sm:px-3 py-1 sm:py-2 rounded-lg hover:bg-blue-50 transition-all font-medium text-xs sm:text-sm inline-flex items-center gap-1"
                        >
                          <Edit size={14} className="sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(subject.id)}
                          className="bg-red-100 text-red-700 px-2 sm:px-3 py-1 sm:py-2 rounded-lg hover:bg-red-50 transition-all font-medium text-xs sm:text-sm inline-flex items-center gap-1"
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

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Upload size={24} className="text-green-600" />
                <h2 className="text-xl font-bold text-gray-900">Import Mata Pelajaran</h2>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportResult(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {!importResult ? (
                <form onSubmit={handleImport} className="space-y-4">
                  {/* File Input */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      File Excel (.xlsx)
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx"
                      required
                      className="w-full px-4 py-3 border-2 border-dashed border-green-300 rounded-lg text-gray-900 file:px-4 file:py-2 file:border-0 file:rounded file:bg-green-600 file:text-white file:font-medium cursor-pointer hover:border-green-400 transition-colors"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      📋 Format Excel: Jenjang | Kode | Nama | Nama Arab | Deskripsi | Jam Kredit
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem('accessToken');
                          const response = await fetch('/api/admin/subjects/template', {
                            method: 'GET',
                            headers: {
                              Authorization: `Bearer ${token}`,
                            },
                          });

                          if (!response.ok) {
                            alert('❌ Gagal mengunduh template');
                            return;
                          }

                          const contentDisposition = response.headers.get('content-disposition');
                          let filename = 'mata-pelajaran-template.xlsx';
                          if (contentDisposition) {
                            const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
                            if (filenameMatch) {
                              filename = filenameMatch[1];
                            }
                          }

                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = filename;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          window.URL.revokeObjectURL(url);
                        } catch (error) {
                          console.error('Template download error:', error);
                          alert('❌ Gagal mengunduh template');
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold mt-1 inline-flex items-center gap-1"
                    >
                      <Download size={14} />
                      📥 Download Template
                    </button>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={isImporting}
                      className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {isImporting ? '⏳ Impor...' : '✅ Impor'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowImportModal(false);
                        setImportResult(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  {/* Result Message */}
                  <div
                    className={`p-4 rounded-lg ${
                      importResult.success
                        ? 'bg-green-50 border-l-4 border-green-500'
                        : 'bg-red-50 border-l-4 border-red-500'
                    }`}
                  >
                    <p
                      className={`font-semibold ${
                        importResult.success ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {importResult.success ? '✅ Berhasil!' : '❌ Gagal'}
                    </p>
                    <p className="text-sm text-gray-700 mt-2">
                      {importResult.message || importResult.error}
                    </p>
                    {importResult.details && (
                      <p className="text-xs text-gray-600 mt-1">{importResult.details}</p>
                    )}
                  </div>

                  {/* Details */}
                  {importResult.data && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="font-semibold text-gray-900 mb-2">📊 Detail Import:</p>
                      <ul className="space-y-1 text-sm">
                        <li className="text-green-700">
                          ✓ Berhasil: <strong>{importResult.data.success}</strong>
                        </li>
                        <li className="text-red-700">
                          ✗ Gagal: <strong>{importResult.data.failed}</strong>
                        </li>
                        <li className="text-yellow-700">
                          ⚠ Duplikat: <strong>{importResult.data.duplicates}</strong>
                        </li>
                      </ul>
                      {importResult.data.errors && importResult.data.errors.length > 0 && (
                        <div className="mt-3 max-h-48 overflow-y-auto">
                          <p className="text-xs font-semibold text-gray-700 mb-1">Error Details:</p>
                          <ul className="space-y-1 text-xs text-red-600">
                            {importResult.data.errors.slice(0, 10).map((err: any, idx: number) => (
                              <li key={idx}>
                                Row {err.row}: {err.message}
                              </li>
                            ))}
                            {importResult.data.errors.length > 10 && (
                              <li className="text-gray-600">... dan {importResult.data.errors.length - 10} error lainnya</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Close Button */}
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportResult(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Tutup
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
