'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import { Plus, Trash2, X, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { getCurrentUser } from '@/lib/auth/client';
import { devError } from '@/lib/dev-log';

interface Class {
  id: string;
  name: string;
  levelId: string;
  levelName?: string;
  capacity: number;
}

interface ClassTeacher {
  id: string;
  teacher: {
    id: string;
    name: string;
    email: string;
  };
  subject: {
    id: string;
    code: string;
    name: string;
  };
}

interface Teacher {
  id: string;
  name: string;
  email: string;
}

interface Subject {
  id: string;
  code: string;
  name: string;
}

interface FormData {
  teacherId: string;
  subjectId: string;
}

export default function WaliKelasTeachersPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [classTeachers, setClassTeachers] = useState<ClassTeacher[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedClassName, setSelectedClassName] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<FormData>({ teacherId: '', subjectId: '' });

  useEffect(() => {
    const parsedUser = getCurrentUser();
    if (parsedUser) {
      void fetchClasses(parsedUser.id);
    }
  }, []);

  async function fetchClasses(waliKelasId: string) {
    try {
      setIsLoading(true);
      const response = await apiFetch(`/api/admin/classes?limit=100&waliKelasId=${waliKelasId}`);
      const data = await response.json();

      if (response.ok) {
        setClasses(data.data || []);
      } else {
        setErrorMessage('Gagal memuat daftar kelas');
      }
    } catch (error) {
      devError('Error fetching classes:', error);
      setErrorMessage('Gagal memuat daftar kelas');
    } finally {
      setIsLoading(false);
    }
  }

  const fetchClassTeachers = useCallback(async () => {
    if (!selectedClassId) return;

    try {
      const response = await apiFetch(`/api/admin/classes/${selectedClassId}/teachers`);
      const data = await response.json();

      if (response.ok) {
        setClassTeachers(data.data || []);
      }
    } catch (error) {
      devError('Error fetching class teachers:', error);
    }
  }, [selectedClassId]);

  const fetchClassSubjects = useCallback(async () => {
    if (!selectedClassId) return;

    try {
      const response = await apiFetch(`/api/admin/classes/${selectedClassId}/subjects`);
      const data = await response.json();

      if (response.ok) {
        setSubjects(data.data?.map((cs: { subject: Subject }) => cs.subject) || []);
      }
    } catch (error) {
      devError('Error fetching subjects:', error);
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (selectedClassId) {
      void fetchClassTeachers();
      void fetchClassSubjects();
    }
  }, [selectedClassId, fetchClassTeachers, fetchClassSubjects]);

  async function fetchTeachers() {
    try {
      // Fetch teachers with TEACHER or WALI_KELAS role
      const response = await apiFetch(`/api/admin/users?limit=100&role=TEACHER`);
      const data = await response.json();

      if (response.ok) {
        setTeachers(data.data || []);
      }
    } catch (error) {
      devError('Error fetching teachers:', error);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!formData.teacherId || !formData.subjectId) {
      setErrorMessage('Pilih guru dan mata pelajaran');
      return;
    }

    try {
      const response = await apiFetch(`/api/admin/classes/${selectedClassId}/teachers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSuccessMessage('Guru berhasil ditambahkan');
        setShowForm(false);
        setFormData({ teacherId: '', subjectId: '' });
        void fetchClassTeachers();
      } else {
        const error = await response.json();
        setErrorMessage(error.error || 'Terjadi kesalahan');
      }
    } catch (error) {
      devError('Error submitting form:', error);
      setErrorMessage('Terjadi kesalahan saat menyimpan data');
    }
  }

  async function handleDelete(classTeacherId: string) {
    if (!confirm('Hapus guru dari kelas?')) return;

    try {
      const response = await apiFetch(`/api/admin/classes/${selectedClassId}/teachers/${classTeacherId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSuccessMessage('Guru berhasil dihapus');
        void fetchClassTeachers();
      } else {
        setErrorMessage('Gagal menghapus guru');
      }
    } catch (error) {
      devError('Error deleting:', error);
      setErrorMessage('Terjadi kesalahan');
    }
  }

  // View: Classes List
  if (!selectedClassId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Guru Pengajar Kelas</h1>
          <p className="text-gray-600 mt-1">Kelola guru yang mengajar di setiap kelas</p>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle size={20} />
            {errorMessage}
            <button onClick={() => setErrorMessage('')} className="ml-auto">
              <X size={18} />
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Memuat data kelas...</p>
          </div>
        ) : classes.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <p className="text-yellow-800">Anda belum ditugaskan sebagai Wali Kelas di kelas manapun.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((classItem) => (
              <div
                key={classItem.id}
                onClick={() => {
                  setSelectedClassId(classItem.id);
                  setSelectedClassName(classItem.name);
                  void fetchTeachers();
                }}
                className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-all cursor-pointer border-l-4 border-emerald-500 p-6 group"
              >
                <h3 className="text-xl font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                  {classItem.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{classItem.levelName}</p>
                <div className="mt-4 text-emerald-600 group-hover:translate-x-1 transition-transform">
                  Klik untuk kelola guru →
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // View: Teachers for selected class
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setSelectedClassId(null);
              setSelectedClassName('');
              setFormData({ teacherId: '', subjectId: '' });
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Guru - {selectedClassName}
            </h1>
            <p className="text-gray-600 mt-1">Kelola guru pengajar di kelas ini</p>
          </div>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setFormData({ teacherId: '', subjectId: '' });
          }}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center gap-2 transition-colors"
        >
          <Plus size={20} /> Tambah Guru
        </button>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle size={20} />
          {successMessage}
          <button onClick={() => setSuccessMessage('')} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {errorMessage}
          <button onClick={() => setErrorMessage('')} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-emerald-500">
          <h2 className="text-xl font-semibold mb-4">Tambah Guru</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Guru <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.teacherId}
                  onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  required
                >
                  <option value="">-- Pilih Guru --</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Mata Pelajaran <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.subjectId}
                  onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  required
                >
                  <option value="">-- Pilih Mata Pelajaran --</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.code} - {subject.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Tambahkan
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormData({ teacherId: '', subjectId: '' });
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Teachers Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nama Guru</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Mata Pelajaran</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  Memuat data...
                </td>
              </tr>
            ) : classTeachers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  Belum ada guru untuk kelas ini
                </td>
              </tr>
            ) : (
              classTeachers.map((ct) => (
                <tr key={ct.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{ct.teacher.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{ct.teacher.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{ct.subject.code} - {ct.subject.name}</td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleDelete(ct.id)}
                      className="text-red-600 hover:text-red-900 inline-flex items-center gap-1"
                      title="Hapus"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
