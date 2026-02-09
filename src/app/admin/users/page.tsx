'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Search, ChevronLeft, ChevronRight, Users, Eye, EyeOff } from 'lucide-react';

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
  createdAt: string;
  school: School;
}

interface PaginatedResponse {
  success: boolean;
  data: User[];
  page: number;
  limit: number;
  total: number;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<{
    email: string;
    name: string;
    password: string;
    role: 'ADMIN' | 'TEACHER' | 'PRINCIPAL' | 'WALI_KELAS';
    schoolId: string;
    isActive: boolean;
  }>({
    email: '',
    name: '',
    password: '',
    role: 'TEACHER',
    schoolId: '',
    isActive: true,
  });

  const limit = 10;

  useEffect(() => {
    fetchUsers();
    fetchSchools();
  }, [page, search]);

  async function fetchUsers() {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
      });

      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/users?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: PaginatedResponse = await response.json();
      setUsers(data.data || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchSchools() {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/admin/schools?limit=100', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: any = await response.json();
      setSchools(data.data || []);
    } catch (error) {
      console.error('Failed to fetch schools:', error);
    }
  }

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
      const token = localStorage.getItem('accessToken');
      if (!token) {
        alert('❌ Token tidak ditemukan. Silakan login terlebih dahulu.');
        return;
      }

      const url = editingId ? `/api/admin/users/${editingId}` : '/api/admin/users';
      const submitData = editingId
        ? { ...formData, ...(formData.password ? { password: formData.password } : {}) }
        : formData;

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
        });
        setShowPassword(false);
        fetchUsers();
      } else {
        let errorMsg = 'Gagal menyimpan data';
        if (result.error) {
          errorMsg = result.error;
        } else if (result.details && Array.isArray(result.details)) {
          errorMsg = result.details.map((d: any) => d.message || d).join(', ');
        }
        alert(`❌ ${errorMsg}`);
      }
    } catch (error) {
      console.error('Failed to save user:', error);
      alert(`❌ Gagal menyimpan data. Silakan coba lagi.\n${error instanceof Error ? error.message : ''}`);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Apakah Anda yakin ingin menghapus user ini?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert('✅ User berhasil dihapus!');
        fetchUsers();
      } else {
        const result = await response.json();
        alert(`❌ ${result.error || 'Gagal menghapus user'}`);
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('❌ Gagal menghapus user');
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

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manajemen Pengguna</h1>
          <p className="text-gray-600 text-sm mt-1">Kelola pengguna sistem Anda</p>
        </div>
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
            });
            setShowForm(true);
            setShowPassword(false);
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl font-medium"
        >
          <Plus size={20} />
          Tambah Pengguna
        </button>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-lg shadow p-4">
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
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Form Section */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            {editingId ? '✏️ Edit Pengguna' : '➕ Tambah Pengguna Baru'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
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
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
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
      {totalPages > 1 && (
        <div className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Selanjutnya
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
