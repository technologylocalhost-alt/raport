'use client';

import { useEffect, useState, FormEvent } from 'react';
import { BookOpen, Search, ChevronLeft, ChevronRight, Loader, Plus, Edit, Trash2, X, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

interface Class {
  id: string;
  name: string;
  levelId: string;
  levelName?: string;
  capacity: number;
  _count?: {
    students?: number;
  };
}

interface ClassSubject {
  id: string;
  subjectId: string;
  subject: {
    id: string;
    code: string;
    name: string;
    description?: string;
    creditHours?: number;
  };
}

interface Subject {
  id: string;
  code: string;
  name: string;
  description?: string;
  creditHours?: number;
}

interface FormData {
  subjectId: string;
}

export default function WaliKelasSubjectsPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedClassName, setSelectedClassName] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<FormData>({ subjectId: '' });

  const itemsPerPage = 10;

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      const parsedUser = JSON.parse(user);
      fetchClasses(parsedUser.id);
    }
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchClassSubjects();
    }
  }, [selectedClassId, currentPage, searchTerm]);

  async function fetchClasses(waliKelasId: string) {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };

      const response = await fetch(`/api/admin/classes?limit=100&waliKelasId=${waliKelasId}`, { headers });
      const data = await response.json();

      if (response.ok) {
        setClasses(data.data || []);
      } else {
        setErrorMessage('Gagal memuat daftar kelas');
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
      setErrorMessage('Gagal memuat daftar kelas');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchClassSubjects() {
    if (!selectedClassId) return;

    try {
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };

      const response = await fetch(`/api/admin/classes/${selectedClassId}/subjects`, { headers });
      const data = await response.json();

      if (response.ok) {
        setClassSubjects(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching class subjects:', error);
    }
  }

  async function fetchAllSubjects() {
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };

      const response = await fetch(`/api/admin/subjects?limit=100`, { headers });
      const data = await response.json();

      if (response.ok) {
        setAllSubjects(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!formData.subjectId) {
      setErrorMessage('Pilih mata pelajaran');
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(`/api/admin/classes/${selectedClassId}/subjects`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ subjectId: formData.subjectId }),
      });

      if (response.ok) {
        setSuccessMessage('Mata pelajaran berhasil ditambahkan');
        setShowForm(false);
        setFormData({ subjectId: '' });
        fetchClassSubjects();
      } else {
        const error = await response.json();
        setErrorMessage(error.error || 'Terjadi kesalahan');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setErrorMessage('Terjadi kesalahan saat menyimpan data');
    }
  }

  async function handleDelete(classSubjectId: string, subjectId: string) {
    if (!confirm('Hapus mata pelajaran dari kelas?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/classes/${selectedClassId}/subjects/${subjectId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        setSuccessMessage('Mata pelajaran berhasil dihapus');
        fetchClassSubjects();
      } else {
        setErrorMessage('Gagal menghapus mata pelajaran');
      }
    } catch (error) {
      console.error('Error deleting:', error);
      setErrorMessage('Terjadi kesalahan');
    }
  }

  // View: Classes List
  if (!selectedClassId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mata Pelajaran Kelas</h1>
          <p className="text-gray-600 mt-1">Kelola mata pelajaran untuk setiap kelas Anda</p>
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
                  fetchAllSubjects();
                }}
                className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-all cursor-pointer border-l-4 border-emerald-500 p-6 group"
              >
                <h3 className="text-xl font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                  {classItem.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{classItem.levelName}</p>
                <div className="mt-4 text-emerald-600 group-hover:translate-x-1 transition-transform">
                  Klik untuk kelola mata pelajaran →
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // View: Subjects for selected class
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setSelectedClassId(null);
              setSelectedClassName('');
              setFormData({ subjectId: '' });
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Mata Pelajaran - {selectedClassName}
            </h1>
            <p className="text-gray-600 mt-1">Kelola mata pelajaran di kelas ini</p>
          </div>
        </div>
        <button
          onClick={() => {
            if (!allSubjects.length) fetchAllSubjects();
            setShowForm(true);
            setFormData({ subjectId: '' });
          }}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center gap-2 transition-colors"
        >
          <Plus size={20} /> Tambah Mata Pelajaran
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
          <h2 className="text-xl font-semibold mb-4">Tambah Mata Pelajaran</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Pilih Mata Pelajaran <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.subjectId}
                onChange={(e) => setFormData({ subjectId: e.target.value })}
                className="w-full px-4 py-3 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                required
              >
                <option value="">-- Pilih Mata Pelajaran --</option>
                {allSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.code} - {subject.name}
                  </option>
                ))}
              </select>
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
                  setFormData({ subjectId: '' });
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subjects Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Kode</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nama Mata Pelajaran</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Deskripsi</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">SKS</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Memuat data...
                </td>
              </tr>
            ) : classSubjects.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Belum ada mata pelajaran untuk kelas ini
                </td>
              </tr>
            ) : (
              classSubjects.map((cs) => (
                <tr key={cs.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{cs.subject.code}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{cs.subject.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                    {cs.subject.description || '-'}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-700">
                    {cs.subject.creditHours || '-'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleDelete(cs.id, cs.subject.id)}
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
