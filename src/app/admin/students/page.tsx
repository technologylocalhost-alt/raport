'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Search, ChevronLeft, ChevronRight, Users, X, Filter } from 'lucide-react';

interface School {
  id: string;
  name: string;
}

interface Level {
  id: string;
  name: string;
  schoolId: string;
}

interface SchoolYear {
  id: string;
  year: string;
  isActive?: boolean;
}

interface Class {
  id: string;
  name: string;
  levelId?: string;
}

interface Student {
  id: string;
  name: string;
  studentNo: string;
  nourut: number | null;
  email: string;
  phone: string;
  address: string;
  birthDate: string;
  className: string;
  levelName: string;
  schoolYear: string;
  classId: string;
}

interface PaginatedResponse {
  success: boolean;
  data: Student[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function StudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterSchool, setFilterSchool] = useState('');
  const [filterSchoolYear, setFilterSchoolYear] = useState('');
  const [filterClass, setFilterClass] = useState('');

  const [formData, setFormData] = useState<{
    name: string;
    studentNo: string;
    nourut: string;
    email: string;
    phone: string;
    address: string;
    birthDate: string;
    classId: string;
    parentPhoneNo: string;
  }>({
    name: '',
    studentNo: '',
    nourut: '',
    email: '',
    phone: '',
    address: '',
    birthDate: '',
    classId: '',
    parentPhoneNo: '',
  });

  const limit = 10;

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    // Reset ke halaman 1 ketika filterSchool, filterSchoolYear, filterClass atau search berubah
    setPage(1);
  }, [filterSchool, filterSchoolYear, filterClass, search]);

  useEffect(() => {
    // Fetch students ketika page, search, atau filterClass berubah
    if (filterClass) {
      fetchStudents(page);
    } else {
      setStudents([]);
      setTotal(0);
    }
  }, [page, filterClass]);

  const getSchoolIdForClass = (classId: string): string | undefined => {
    const classObj = classes.find(c => c.id === classId);
    if (!classObj?.levelId) return undefined;
    const level = levels.find(l => l.id === classObj.levelId);
    return level?.schoolId;
  };

  async function fetchClasses() {
    try {
      const token = localStorage.getItem('accessToken');
      
      // Fetch school years
      const yearsResponse = await fetch('/api/admin/school-years?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const yearsData = await yearsResponse.json();
      setSchoolYears(yearsData.data || []);

      // Fetch schools
      const schoolsResponse = await fetch('/api/admin/schools?limit=1000', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const schoolsData = await schoolsResponse.json();
      setSchools(schoolsData.data || []);

      // Fetch levels
      const levelsResponse = await fetch('/api/admin/levels?limit=1000', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const levelsData = await levelsResponse.json();
      setLevels(levelsData.data || []);
      
      const response = await fetch(`/api/admin/classes?limit=1000${filterSchoolYear ? `&schoolYearId=${filterSchoolYear}` : ''}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: any = await response.json();
      if (data.success && data.data) {
        setClasses(data.data.map((c: any) => ({ id: c.id, name: c.name, levelId: c.levelId })));
      }
    } catch (error) {
      console.error('Failed to fetch classes:', error);
    }
  }

  async function fetchStudents(pageNum: number = page) {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(filterClass && { classId: filterClass }),
      });

      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/students?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: PaginatedResponse = await response.json();
      setStudents(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to fetch students:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    if (filterClass) {
      setPage(1);
    }
  };

  const handleAddClick = () => {
    setFormData({
      name: '',
      studentNo: '',
      nourut: '',
      email: '',
      phone: '',
      address: '',
      birthDate: '',
      classId: '',
      parentPhoneNo: '',
    });
    setEditingId(null);
    setShowForm(true);
  };

  const handleEditClick = (student: Student) => {
    // Convert birthDate to YYYY-MM-DD format for input[type="date"]
    let formattedBirthDate = '';
    if (student.birthDate) {
      const date = new Date(student.birthDate);
      formattedBirthDate = date.toISOString().split('T')[0];
    }

    setFormData({
      name: student.name,
      studentNo: student.studentNo,
      nourut: student.nourut?.toString() || '',
      email: student.email,
      phone: student.phone,
      address: student.address,
      birthDate: formattedBirthDate,
      classId: student.classId,
      parentPhoneNo: '',
    });
    setEditingId(student.id);
    setShowForm(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('accessToken');

      // Prepare data with nourut as number or null
      const submitData = {
        ...formData,
        nourut: formData.nourut ? parseInt(formData.nourut) : null,
      };

      if (editingId) {
        // Update student
        const response = await fetch(`/api/admin/students/${editingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(submitData),
        });

        if (!response.ok) {
          alert('Gagal mengubah siswa');
          return;
        }
      } else {
        // Create new student
        const response = await fetch('/api/admin/students', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(submitData),
        });

        if (!response.ok) {
          alert('Gagal menambah siswa');
          return;
        }
      }

      setShowForm(false);
      fetchStudents(page);
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Terjadi kesalahan');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus siswa ini?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/students/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        alert('Gagal menghapus siswa');
        return;
      }

      fetchStudents(page);
    } catch (error) {
      console.error('Error deleting student:', error);
      alert('Terjadi kesalahan');
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manajemen Siswa</h1>
          <p className="text-gray-600 mt-2">Total: {total} siswa</p>
        </div>
        <button
          onClick={handleAddClick}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors font-medium"
        >
          <Plus size={20} />
          Tambah Siswa
        </button>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} className="text-emerald-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filter & Pencarian</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* School Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Sekolah
            </label>
            <select
              value={filterSchool}
              onChange={(e) => {
                setFilterSchool(e.target.value);
                setFilterSchoolYear('');
                setFilterClass('');
                setPage(1);
                fetchClasses();
              }}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-gray-900 bg-white"
            >
              <option value="">-- Semua Sekolah --</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>

          {/* School Year Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Tahun Ajaran
            </label>
            <select
              value={filterSchoolYear}
              onChange={(e) => {
                setFilterSchoolYear(e.target.value);
                setFilterClass('');
                setPage(1);
                // Refetch classes when school year changes
                fetchClasses();
              }}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-gray-900 bg-white"
            >
              <option value="">-- Semua Tahun --</option>
              {schoolYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.year} {year.isActive ? '(Aktif)' : '(Nonaktif)'}
                </option>
              ))}
            </select>
          </div>

          {/* Class Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Pilih Kelas
            </label>
            <select
              value={filterClass}
              onChange={(e) => {
                setFilterClass(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-gray-900 bg-white"
            >
              <option value="">-- Semua Kelas --</option>
              {classes.filter(c => !filterSchool || getSchoolIdForClass(c.id) === filterSchool).map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Pencarian
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Cari nama, nomor induk, atau email..."
                value={search}
                onChange={handleSearch}
                disabled={!filterClass}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 font-medium placeholder-gray-500 bg-white focus:bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {!filterClass ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Users size={64} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg font-medium">Silakan pilih kelas terlebih dahulu</p>
              <p className="text-gray-500 text-sm mt-2">Gunakan filter di atas untuk memulai</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Memuat data siswa...</p>
            </div>
          </div>
        ) : students.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Users size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Tidak ada data siswa untuk kelas ini</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      No Urut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      No. Siswa
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Nama Siswa
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Kelas
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Telepon
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {student.nourut || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {student.studentNo}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{student.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{student.className}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{student.email || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{student.phone || '-'}</td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <button
                          onClick={() => handleEditClick(student)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-colors"
                        >
                          <Edit size={16} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(student.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors"
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
            <div className="px-6 py-4 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm font-medium text-gray-700">
                Halaman {page} dari {totalPages} • Menampilkan {(page - 1) * limit + 1}-{Math.min(page * limit, total)} dari {total} data
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                  title="Halaman sebelumnya"
                >
                  <ChevronLeft size={18} className="text-gray-700" />
                </button>
                <div className="flex items-center gap-1">
                  {page > 2 && (
                    <>
                      <button
                        onClick={() => setPage(1)}
                        className="px-3 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-100 font-medium text-gray-700"
                      >
                        1
                      </button>
                      {page > 3 && <span className="px-2 text-gray-500">...</span>}
                    </>
                  )}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, page - 2) + i;
                    if (pageNum > totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          page === pageNum
                            ? 'bg-emerald-600 text-white border border-emerald-600'
                            : 'border border-gray-300 hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {page < totalPages - 1 && (
                    <>
                      {page < totalPages - 2 && <span className="px-2 text-gray-500">...</span>}
                      <button
                        onClick={() => setPage(totalPages)}
                        className="px-3 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-100 font-medium text-gray-700"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                  title="Halaman berikutnya"
                >
                  <ChevronRight size={18} className="text-gray-700" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b sticky top-0 bg-white">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                {editingId ? 'Edit Siswa' : 'Tambah Siswa'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Siswa *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white font-medium text-sm sm:text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  No. Induk Siswa *
                </label>
                <input
                  type="text"
                  value={formData.studentNo}
                  onChange={(e) => setFormData({ ...formData, studentNo: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nomor Urut
                </label>
                <input
                  type="number"
                  value={formData.nourut}
                  onChange={(e) => setFormData({ ...formData, nourut: e.target.value })}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-gray-100 font-medium disabled:cursor-not-allowed"
                  placeholder="Masukkan nomor urut"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kelas *
                </label>
                <select
                  value={formData.classId}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  required
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-gray-100 font-medium disabled:cursor-not-allowed"
                >
                  <option value="">-- Pilih Kelas --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telepon
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alamat
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal Lahir
                </label>
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white font-medium"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm sm:text-base"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm sm:text-base"
                >
                  {editingId ? 'Simpan' : 'Tambah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
