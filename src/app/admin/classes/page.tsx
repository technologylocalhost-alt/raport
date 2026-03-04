'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Search, ChevronLeft, ChevronRight, Users, X, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';

interface Level {
  id: string;
  name: string;
  code: string;
}

interface SchoolYear {
  id: string;
  year: string;
  isActive?: boolean;
}

interface Semester {
  id: string;
  number: number;
  schoolYearId: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Teacher {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ClassTeacher {
  teacherId: string;
  subjectId: string;
  teacher: User;
  subject: Subject;
}

interface ClassData {
  id: string;
  name: string;
  levelId: string;
  schoolYearId: string;
  semesterId: string;
  capacity: number;
  waliKelasId?: string;
  level: Level;
  schoolYear: SchoolYear;
  semester: Semester;
  teachers: ClassTeacher[];
  waliKelas?: User;
  _count: {
    students: number;
  };
}

interface PaginatedResponse {
  success: boolean;
  data: ClassData[];
  page: number;
  limit: number;
  total: number;
}

export default function ClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterSchoolYearId, setFilterSchoolYearId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedTeachers, setSelectedTeachers] = useState<Array<{ teacherId: string; subjectId: string }>>([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    levelId: '',
    schoolYearId: '',
    semesterId: '',
    capacity: 40,
    waliKelasId: '',
  });

  const limit = 10;

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [page, search, filterSchoolYearId]);

  // Fetch semester when schoolYear changes
  useEffect(() => {
    if (formData.schoolYearId) {
      fetchSemesters(formData.schoolYearId);
    }
  }, [formData.schoolYearId]);

  async function fetchInitialData() {
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };

      const [levelsRes, yearsRes, teachersRes, waliKelasRes, subjectsRes] = await Promise.all([
        fetch('/api/admin/levels?limit=100', { headers }),
        fetch('/api/admin/school-years?limit=100', { headers }),
        fetch('/api/admin/users?limit=100&role=TEACHER', { headers }),
        fetch('/api/admin/users?limit=100&role=WALI_KELAS', { headers }),
        fetch('/api/admin/subjects?limit=100', { headers }),
      ]);

      const levelsData = await levelsRes.json();
      const yearsData = await yearsRes.json();
      const teachersData = await teachersRes.json();
      const waliKelasData = await waliKelasRes.json();
      const subjectsData = await subjectsRes.json();

      setLevels(levelsData.data || []);
      setSchoolYears(yearsData.data || []);
      // Combine teachers and wali kelas
      const combinedStaff = [...(teachersData.data || []), ...(waliKelasData.data || [])];
      setTeachers(combinedStaff);
      setSubjects(subjectsData.data || []);

      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
      setIsLoading(false);
    }
  }

  async function fetchClasses() {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(filterSchoolYearId && { schoolYearId: filterSchoolYearId }),
      });

      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/classes?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: any = await response.json();
      setClasses(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to fetch classes:', error);
    }
  }

  async function fetchSemesters(schoolYearId: string) {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/school-years/${schoolYearId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      setSemesters(data.data?.semesters || []);
    } catch (error) {
      console.error('Failed to fetch semesters:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!formData.name || !formData.levelId || !formData.schoolYearId || !formData.semesterId) {
      setErrorMessage('Nama kelas, level, tahun akademik, dan semester harus diisi!');
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setErrorMessage('Token tidak ditemukan. Silakan login terlebih dahulu.');
        return;
      }

      const url = editingId ? `/api/admin/classes/${editingId}` : '/api/admin/classes';

      const payload = {
        ...formData,
        capacity: parseInt(formData.capacity.toString()),
        ...(selectedTeachers.length > 0 && { teachers: selectedTeachers }),
      };

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccessMessage(editingId ? '✅ Kelas berhasil diperbarui!' : '✅ Kelas berhasil ditambahkan!');
        setTimeout(() => {
          setShowForm(false);
          setEditingId(null);
          setFormData({
            name: '',
            levelId: '',
            schoolYearId: '',
            semesterId: '',
            capacity: 40,
            waliKelasId: '',
          });
          setSelectedTeachers([]);
          setSuccessMessage('');
          fetchClasses();
        }, 1500);
      } else {
        let errorMsg = 'Gagal menyimpan data';
        if (result.error) {
          errorMsg = result.error;
        }
        setErrorMessage(errorMsg);
      }
    } catch (error) {
      console.error('Failed to save class:', error);
      setErrorMessage('Gagal menyimpan data. Silakan coba lagi.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Apakah Anda yakin ingin menghapus kelas ini?')) return;

    setErrorMessage('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/classes/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setSuccessMessage('✅ Kelas berhasil dihapus!');
        setTimeout(() => {
          setSuccessMessage('');
          fetchClasses();
        }, 1500);
      } else {
        const result = await response.json();
        setErrorMessage(result.error || 'Gagal menghapus kelas');
      }
    } catch (error) {
      console.error('Failed to delete class:', error);
      setErrorMessage('Gagal menghapus kelas');
    }
  }

  function handleEdit(classData: ClassData) {
    setFormData({
      name: classData.name,
      levelId: classData.levelId,
      schoolYearId: classData.schoolYearId,
      semesterId: classData.semesterId,
      capacity: classData.capacity,
      waliKelasId: classData.waliKelasId || '',
    });
    setSelectedTeachers(
      classData.teachers.map((t) => ({
        teacherId: t.teacherId,
        subjectId: t.subjectId,
      }))
    );
    setEditingId(classData.id);
    setShowForm(true);
  }

  function addTeacherRow() {
    setSelectedTeachers([...selectedTeachers, { teacherId: '', subjectId: '' }]);
  }

  function removeTeacherRow(index: number) {
    setSelectedTeachers(selectedTeachers.filter((_, i) => i !== index));
  }

  function updateTeacherRow(index: number, field: string, value: string) {
    const updated = [...selectedTeachers];
    updated[index] = { ...updated[index], [field]: value };
    setSelectedTeachers(updated);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manajemen Kelas</h1>
          <p className="text-gray-600 text-sm mt-1">Kelola kelas dan guru pengajar</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({
              name: '',
              levelId: '',
              schoolYearId: '',
              semesterId: '',
              capacity: 40,
              waliKelasId: '',
            });
            setSelectedTeachers([]);
            setShowForm(true);
          }}
          className="flex items-center justify-center sm:justify-start gap-2 bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl font-medium whitespace-nowrap"
        >
          <Plus size={20} />
          <span className="hidden xs:hidden sm:inline">Tambah Kelas</span>
          <span className="inline sm:hidden">Tambah</span>
        </button>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Cari kelas..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Filter Tahun Ajaran
          </label>
          <select
            value={filterSchoolYearId}
            onChange={(e) => {
              setFilterSchoolYearId(e.target.value);
              setPage(1);
            }}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 bg-white"
          >
            <option value="">-- Semua Tahun Ajaran --</option>
            {schoolYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.year} {year.isActive ? '(Aktif)' : '(Nonaktif)'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alert Messages */}
      {successMessage && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          <CheckCircle size={20} className="flex-shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          <AlertCircle size={20} className="flex-shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Form Section */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            {editingId ? '✏️ Edit Kelas' : '➕ Tambah Kelas Baru'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nama Kelas <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 1A, 2B, 3C"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Level <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.levelId}
                  onChange={(e) => setFormData({ ...formData, levelId: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                >
                  <option value="">-- Pilih Level --</option>
                  {levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name} ({level.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2 */}
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
                  Semester <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.semesterId}
                  onChange={(e) => setFormData({ ...formData, semesterId: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                  disabled={!formData.schoolYearId}
                >
                  <option value="">-- Pilih Semester --</option>
                  {semesters.map((sem) => (
                    <option key={sem.id} value={sem.id}>
                      Semester {sem.number}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Kapasitas Siswa
                </label>
                <input
                  type="number"
                  placeholder="40"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 40 })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Wali Kelas (Opsional)
                </label>
                <select
                  value={formData.waliKelasId}
                  onChange={(e) => setFormData({ ...formData, waliKelasId: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                >
                  <option value="">-- Pilih Wali Kelas --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Teachers Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-semibold text-gray-700">
                  Guru & Mata Pelajaran
                </label>
                <button
                  type="button"
                  onClick={addTeacherRow}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  + Tambah Guru
                </button>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {selectedTeachers.map((teacher, index) => (
                  <div key={index} className="flex gap-2">
                    <select
                      value={teacher.teacherId}
                      onChange={(e) => updateTeacherRow(index, 'teacherId', e.target.value)}
                      className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">-- Pilih Guru --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.email})
                        </option>
                      ))}
                    </select>

                    <select
                      value={teacher.subjectId}
                      onChange={(e) => updateTeacherRow(index, 'subjectId', e.target.value)}
                      className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">-- Pilih Mata Pelajaran --</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => removeTeacherRow(index)}
                      className="p-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-6">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                {editingId ? 'Simpan Perubahan' : 'Tambah Kelas'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({
                    name: '',
                    levelId: '',
                    schoolYearId: '',
                    semesterId: '',
                    capacity: 40,
                    waliKelasId: '',
                  });
                  setSelectedTeachers([]);
                  setErrorMessage('');
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
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Nama Kelas</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Level</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">T.A.</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Sem</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Wali</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Guru</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Siswa</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-900">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : classes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                  Tidak ada kelas ditemukan
                </td>
              </tr>
            ) : (
              classes.map((classData) => (
                <tr key={classData.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">{classData.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {classData.level.code}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{classData.schoolYear.year}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    S{classData.semester.number}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {classData.waliKelas ? (
                      <span className="inline-block px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm font-medium">
                        {classData.waliKelas.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    <div className="flex flex-wrap gap-1">
                      {classData.teachers.length > 0 ? (
                        classData.teachers.slice(0, 2).map((teacher) => (
                          <span
                            key={`${teacher.teacherId}-${teacher.subjectId}`}
                            className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs whitespace-nowrap"
                            title={`${teacher.teacher.name} - ${teacher.subject.name}`}
                          >
                            {teacher.subject.code}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                      {classData.teachers.length > 2 && (
                        <span className="inline-block px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs font-medium">
                          +{classData.teachers.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                      {classData._count.students}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    <div className="flex justify-center gap-1">
                      <a
                        href={`/admin/naik-kelas?classId=${classData.id}`}
                        className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors inline-flex"
                        title="Naik Kelas"
                      >
                        <TrendingUp size={16} />
                      </a>
                      <button
                        onClick={() => handleEdit(classData)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(classData.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Hapus"
                      >
                        <Trash2 size={16} />
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
