'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Search, ChevronLeft, ChevronRight, Eye, EyeOff, Download, Upload } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { devError } from '@/lib/dev-log';

interface School {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'TEACHER' | 'PRINCIPAL' | 'WALI_KELAS';
  schoolId: string;
  isActive: boolean;
  bagian: string[];
  createdAt: string;
  school: School;
}

interface PaginatedResponse {
  success: boolean;
  data: User[];
  page: number;
  limit: number;
  total: number;
  pagination?: { total?: number };
}

interface SchoolListResponse {
  data?: School[];
}

interface ImportResultState {
  imported?: number;
  updated?: number;
  skipped?: number;
  errors?: string[];
}

interface ValidationDetail {
  message?: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResultState | null>(null);
  const [showImportResult, setShowImportResult] = useState(false);
  const [formData, setFormData] = useState<{
    email: string;
    name: string;
    password: string;
    role: 'ADMIN' | 'TEACHER' | 'PRINCIPAL' | 'WALI_KELAS';
    schoolId: string;
    isActive: boolean;
    bagian: string[];
  }>({
    email: '',
    name: '',
    password: '',
    role: 'TEACHER',
    schoolId: '',
    isActive: true,
    bagian: [],
  });

  const limit = 10;

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
      });

      const response = await apiFetch(`/api/admin/users?${queryParams}`);

      const data: PaginatedResponse = await response.json();
      setUsers(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      devError('Failed to fetch users:', error);
    } finally {
      setIsLoading(false);
    }
  }, [limit, page, search]);

  const fetchSchools = useCallback(async () => {
    try {
      const response = await apiFetch('/api/admin/schools?limit=100');

      const data: SchoolListResponse = await response.json();
      setSchools(data.data || []);
    } catch (error) {
      devError('Failed to fetch schools:', error);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
    void fetchSchools();
  }, [fetchSchools, fetchUsers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.email || !formData.name || !formData.schoolId) {
      alert('Email, Nama, dan Sekolah tidak boleh kosong!');
      return;
    }

    if (!editingId && !formData.password) {
      alert('Password harus diisi untuk user baru!');
      return;
    }

    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      alert('Email yang dimasukkan tidak valid!');
      return;
    }

    try {
      const url = editingId ? `/api/admin/users/${editingId}` : '/api/admin/users';
      const submitData = editingId
        ? { ...formData, ...(formData.password ? { password: formData.password } : {}) }
        : formData;

      const response = await apiFetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();

      if (response.ok) {
        alert(editingId ? '✅ User berhasil diperbarui!' : '✅ User berhasil ditambahkan!');
        setShowForm(false);
        setEditingId(null);
        setFormData({
          email: '',
          name: '',
          password: '',
          role: 'TEACHER',
          schoolId: '',
          isActive: true,
          bagian: [],
        });
        setShowPassword(false);
        void fetchUsers();
      } else {
        let errorMsg = 'Gagal menyimpan data';
        if (result.error) {
          errorMsg = result.error;
        } else if (result.details && Array.isArray(result.details)) {
          errorMsg = (result.details as ValidationDetail[]).map((d) => d.message || JSON.stringify(d)).join(', ');
        }
        alert(`❌ ${errorMsg}`);
      }
    } catch (error) {
      devError('Failed to save user:', error);
      alert(`❌ Gagal menyimpan data. Silakan coba lagi.\n${error instanceof Error ? error.message : ''}`);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Apakah Anda yakin ingin menghapus user ini?')) return;

    try {
      const response = await apiFetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('✅ User berhasil dihapus!');
        void fetchUsers();
      } else {
        const result = await response.json();
        alert(`❌ ${result.error || 'Gagal menghapus user'}`);
      }
    } catch (error) {
      devError('Failed to delete user:', error);
      alert('❌ Gagal menghapus user');
    }
  }

  async function handleDownloadTemplate() {
    try {
      const response = await apiFetch('/api/admin/users/template');

      if (!response.ok) {
        alert('❌ Gagal mengunduh template');
        return;
      }

      const blob = await response.blob();
      const fileName = response.headers.get('content-disposition')?.split('filename=')[1]?.slice(1, -1) || 'template-users.xlsx';
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      devError('Download template error:', error);
      alert('❌ Gagal mengunduh template');
    }
  }

  async function handleExport() {
    try {
      const response = await apiFetch('/api/admin/users/export');

      if (!response.ok) {
        alert('❌ Gagal mengekspor data');
        return;
      }

      const blob = await response.blob();
      const fileName = response.headers.get('content-disposition')?.split('filename=')[1]?.slice(1, -1) || 'users.xlsx';
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      devError('Export error:', error);
      alert('❌ Gagal mengekspor data');
    }
  }

  async function handleImport(file: File) {
    try {
      setIsImporting(true);

      const formData = new FormData();
      formData.append('file', file);

      const response = await apiFetch('/api/admin/users/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setImportResult(data.data);
        setShowImportResult(true);
        void fetchUsers();
        alert(`✅ ${data.data.imported + data.data.updated} user berhasil diimpor/diperbarui`);
      } else {
        alert(`❌ ${data.error || 'Gagal mengimpor data'}`);
      }
    } catch (error) {
      devError('Import error:', error);
      alert('❌ Gagal mengimpor data');
    } finally {
      setIsImporting(false);
    }
  }

  function handleEdit(user: User) {
    setFormData({
      email: user.email,
      name: user.name,
      password: '',
      role: user.role,
      schoolId: user.schoolId,
      isActive: user.isActive,
      bagian: user.bagian || [],
    });
    setEditingId(user.id);
    setShowForm(true);
    setShowPassword(false);
  }

  const totalPages = Math.ceil(total / limit);
  const roleOptions = ['ADMIN', 'TEACHER', 'PRINCIPAL', 'WALI_KELAS'];
  const roleLabels: Record<string, string> = {
    ADMIN: 'Administrator',
    TEACHER: 'Guru',
    PRINCIPAL: 'Kepala Sekolah',
    WALI_KELAS: 'Wali Kelas',
  };

  const bagianOptions = ['PENGASUHAN', 'MABIKORI', 'PUSDAC', 'LAC', 'EKSKUL'];
  const bagianLabels: Record<string, string> = {
    PENGASUHAN: 'Pengasuhan',
    MABIKORI: 'Mabikori',
    PUSDAC: 'PUSDAC',
    LAC: 'LAC',
    EKSKUL: 'Ekskul',
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manajemen Pengguna</h1>
          <p className="text-gray-600 text-sm mt-1">Kelola pengguna sistem Anda</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({
                email: '',
                name: '',
                password: '',
                role: 'TEACHER',
                schoolId: '',
                isActive: true,
                bagian: [],
              });
              setShowForm(true);
              setShowPassword(false);
            }}
            className="flex items-center justify-center sm:justify-start gap-2 bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl font-medium whitespace-nowrap"
          >
            <Plus size={20} />
            <span className="hidden xs:hidden sm:inline">Tambah Pengguna</span>
            <span className="inline sm:hidden">Tambah</span>
          </button>
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center justify-center sm:justify-start gap-2 bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-green-700 transition-colors shadow-lg hover:shadow-xl font-medium whitespace-nowrap"
          >
            <Download size={20} />
            <span className="hidden xs:hidden sm:inline">Template</span>
            <span className="inline sm:hidden">Template</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center justify-center sm:justify-start gap-2 bg-purple-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-purple-700 transition-colors shadow-lg hover:shadow-xl font-medium whitespace-nowrap"
          >
            <Download size={20} />
            <span className="hidden xs:hidden sm:inline">Export</span>
            <span className="inline sm:hidden">Export</span>
          </button>
          <label className="flex items-center justify-center sm:justify-start gap-2 bg-orange-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-orange-700 transition-colors shadow-lg hover:shadow-xl font-medium whitespace-nowrap cursor-pointer">
            <Upload size={20} />
            <span className="hidden xs:hidden sm:inline">Import</span>
            <span className="inline sm:hidden">Import</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImport(file);
                }
              }}
              disabled={isImporting}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Cari berdasarkan nama atau email..."
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
            {editingId ? '✏️ Edit Pengguna' : '➕ Tambah Pengguna Baru'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="Masukkan email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                />
              </div>

              {/* Nama */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Masukkan nama lengkap"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as User['role'] })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sekolah */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sekolah <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.schoolId}
                  onChange={(e) => setFormData({ ...formData, schoolId: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                >
                  <option value="">-- Pilih Sekolah --</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password {!editingId && <span className="text-red-500">*</span>}
                  {editingId && <span className="text-gray-500 text-xs">(Kosongkan jika tidak ingin mengubah)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={editingId ? 'Biarkan kosong jika tidak ingin mengubah' : 'Masukkan password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-end">
                <label className="flex items-center gap-3 h-full">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-gray-700">Aktif</span>
                </label>
              </div>
            </div>

            {/* Bagian Multi-Select */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Bagian <span className="text-gray-500 text-xs">(Opsional - bisa pilih lebih dari satu)</span>
              </label>
              <div className="flex flex-wrap gap-3">
                {bagianOptions.map((b) => (
                  <label key={b} className="flex items-center gap-2 px-3 py-2 border-2 border-gray-200 rounded-lg hover:border-blue-300 cursor-pointer transition-all">
                    <input
                      type="checkbox"
                      checked={formData.bagian.includes(b)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, bagian: [...formData.bagian, b] });
                        } else {
                          setFormData({ ...formData, bagian: formData.bagian.filter((x) => x !== b) });
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{bagianLabels[b]}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-6">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                {editingId ? 'Simpan Perubahan' : 'Tambah Pengguna'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({
                    email: '',
                    name: '',
                    password: '',
                    role: 'TEACHER',
                    schoolId: '',
                    isActive: true,
                    bagian: [],
                  });
                  setShowPassword(false);
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
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Nama</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Email</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Role</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Sekolah</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Bagian</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
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
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  Tidak ada pengguna ditemukan
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">{user.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                      {roleLabels[user.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{user.school?.name || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    {user.bagian && user.bagian.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {user.bagian.map((b) => (
                          <span key={b} className="inline-block px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                            {bagianLabels[b] || b}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {user.isActive ? (
                      <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        Aktif
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                        Nonaktif
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
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
      <div className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-900 font-medium"
        >
          <ChevronLeft size={20} />
          Sebelumnya
        </button>
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm text-gray-600">
            Halaman {page} dari {totalPages}
          </span>
          <span className="text-xs text-gray-500">
            Total: {total} pengguna
          </span>
        </div>
        <button
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-900 font-medium"
        >
          Selanjutnya
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Import Result Modal */}
      {showImportResult && importResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Hasil Impor Data</h3>
              <button
                onClick={() => {
                  setShowImportResult(false);
                  setImportResult(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Data Baru</p>
                  <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Data Diupdate</p>
                  <p className="text-2xl font-bold text-blue-600">{importResult.updated}</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Data Dilewati</p>
                  <p className="text-2xl font-bold text-yellow-600">{importResult.skipped}</p>
                </div>
              </div>
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="font-semibold text-red-700 mb-2">Kesalahan ({importResult.errors.length}):</p>
                  <ul className="space-y-1 max-h-48 overflow-y-auto">
                    {importResult.errors.map((error: string, idx: number) => (
                      <li key={idx} className="text-sm text-red-600">• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                onClick={() => {
                  setShowImportResult(false);
                  setImportResult(null);
                }}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
