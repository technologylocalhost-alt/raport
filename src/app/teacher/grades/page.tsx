'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, ChevronLeft, ChevronRight, BookOpen, AlertCircle, CheckCircle } from 'lucide-react';

interface Grade {
  id: string;
  studentId: string;
  studentName: string;
  competencyId: string;
  competencyName: string;
  subjectName: string;
  score: number;
  assessmentType: string;
  notes: string;
  date: string;
}

interface Student {
  id: string;
  name: string;
}

interface Competency {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
}

export default function GradesPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    studentId: '',
    competencyId: '',
    score: '',
    assessmentType: 'DAILY',
    notes: '',
  });

  const limit = 10;
  const totalPages = Math.ceil(total / limit);

  useEffect(() => {
    fetchGrades();
  }, [page, search]);

  useEffect(() => {
    if (showForm && students.length === 0) {
      fetchOptions();
    }
  }, [showForm]);

  useEffect(() => {
    // Ensure options are loaded whenever form opens
    if (showForm && (students.length === 0 || competencies.length === 0)) {
      fetchOptions();
    }
  }, [showForm, students.length, competencies.length]);

  async function fetchGrades() {
    try {
      setLoading(true);
      setErrorMessage('');
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
      });

      const response = await fetch(`/api/teacher/grades?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setGrades(data.data);
        setTotal(data.total);
      } else {
        setErrorMessage(data.message || 'Gagal memuat data nilai');
      }
    } catch (error) {
      console.error('Error fetching grades:', error);
      setErrorMessage('Terjadi kesalahan saat memuat data');
    } finally {
      setLoading(false);
    }
  }

  async function fetchOptions() {
    try {
      setOptionsLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/teacher/grades/options', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setStudents(data.students);
        setCompetencies(data.competencies);
      }
    } catch (error) {
      console.error('Error fetching options:', error);
      setErrorMessage('Gagal memuat data siswa dan kompetensi');
    } finally {
      setOptionsLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Validation
    if (!formData.studentId || !formData.competencyId || !formData.score || !formData.assessmentType) {
      setErrorMessage('Mohon isi semua field yang wajib');
      return;
    }

    const score = parseFloat(formData.score);
    if (isNaN(score) || score < 0 || score > 100) {
      setErrorMessage('Nilai harus antara 0-100');
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const url = editingId ? `/api/teacher/grades/${editingId}` : '/api/teacher/grades';
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          score: score,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccessMessage(editingId ? 'Nilai berhasil diperbarui' : 'Nilai berhasil ditambahkan');
        setTimeout(() => {
          setShowForm(false);
          setEditingId(null);
          setFormData({ studentId: '', competencyId: '', score: '', assessmentType: 'DAILY', notes: '' });
          setSuccessMessage('');
          setPage(1);
          fetchGrades();
        }, 1500);
      } else {
        setErrorMessage(data.message || 'Gagal menyimpan data');
      }
    } catch (error) {
      console.error('Error saving grade:', error);
      setErrorMessage('Terjadi kesalahan saat menyimpan data');
    }
  };

  const handleEdit = async (grade: Grade) => {
    // Set form data first
    setFormData({
      studentId: grade.studentId,
      competencyId: grade.competencyId,
      score: grade.score.toString(),
      assessmentType: grade.assessmentType,
      notes: grade.notes,
    });
    
    // Fetch options if not already loaded
    if (students.length === 0 || competencies.length === 0) {
      await fetchOptions();
    }
    
    setEditingId(grade.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus nilai ini?')) return;

    setErrorMessage('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/teacher/grades/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccessMessage('Nilai berhasil dihapus');
        setTimeout(() => {
          setSuccessMessage('');
          fetchGrades();
        }, 1500);
      } else {
        setErrorMessage(data.message || 'Gagal menghapus nilai');
      }
    } catch (error) {
      console.error('Error deleting grade:', error);
      setErrorMessage('Terjadi kesalahan saat menghapus data');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ studentId: '', competencyId: '', score: '', assessmentType: 'DAILY', notes: '' });
    setErrorMessage('');
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 85) return 'bg-green-500 text-white';
    if (score >= 70) return 'bg-yellow-500 text-white';
    return 'bg-red-500 text-white';
  };

  const getSelectedStudentName = () => {
    return students.find((s) => s.id === formData.studentId)?.name || '';
  };

  const getSelectedCompetencyName = () => {
    const comp = competencies.find((c) => c.id === formData.competencyId);
    return comp ? `${comp.subjectName} - ${comp.name}` : '';
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Input Nilai Siswa</h1>
          <p className="text-gray-600 text-sm mt-1">Kelola nilai siswa berdasarkan kompetensi dan jenis penilaian</p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({ studentId: '', competencyId: '', score: '', assessmentType: 'DAILY', notes: '' });
              setShowForm(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl font-medium"
          >
            <Plus size={20} />
            Tambah Nilai
          </button>
        )}
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

      {/* Search Section */}
      {!showForm && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Cari nama siswa atau mata pelajaran..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-8 border-l-4 border-indigo-500">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            {editingId ? '✏️ Edit Nilai' : '➕ Tambah Nilai Baru'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Siswa - Kompetensi Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Student Select */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Nama Siswa <span className="text-red-500">*</span>
                </label>
                {getSelectedStudentName() && (
                  <p className="text-xs text-indigo-600 font-medium mb-2">Terpilih: {getSelectedStudentName()}</p>
                )}
                <select
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  disabled={optionsLoading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  required
                >
                  <option value="">-- Pilih Siswa --</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Competency Select */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Kompetensi / Mata Pelajaran <span className="text-red-500">*</span>
                </label>
                {getSelectedCompetencyName() && (
                  <p className="text-xs text-indigo-600 font-medium mb-2">Terpilih: {getSelectedCompetencyName()}</p>
                )}
                <select
                  value={formData.competencyId}
                  onChange={(e) => setFormData({ ...formData, competencyId: e.target.value })}
                  disabled={optionsLoading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  required
                >
                  <option value="">-- Pilih Kompetensi --</option>
                  {competencies.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.subjectName} - {comp.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Score - Assessment Type Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Score Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Nilai (0-100) <span className="text-red-500">*</span>
                </label>
                {formData.score && (
                  <p className="text-xs text-indigo-600 font-medium mb-2">Nilai saat ini: {formData.score}</p>
                )}
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="Contoh: 85"
                  value={formData.score}
                  onChange={(e) => setFormData({ ...formData, score: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Masukkan nilai dengan desimal jika diperlukan</p>
              </div>

              {/* Assessment Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Jenis Penilaian <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.assessmentType}
                  onChange={(e) => setFormData({ ...formData, assessmentType: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  required
                >
                  <option value="DAILY">Penilaian Harian</option>
                  <option value="QUIZ">Kuis</option>
                  <option value="TASK">Tugas</option>
                  <option value="PROJECT">Proyek</option>
                  <option value="MIDTERM">UTS (Ujian Tengah Semester)</option>
                  <option value="FINAL">UAS (Ujian Akhir Semester)</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Catatan Penilaian (Opsional)
              </label>
              <textarea
                placeholder="Contoh: Siswa sangat aktif dalam diskusi, pemahaman sangat baik..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-6 border-t">
              <button
                type="submit"
                className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-semibold shadow-lg"
              >
                {editingId ? 'Simpan Perubahan' : 'Tambah Nilai'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {!showForm && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : grades.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen className="mx-auto mb-4 text-indigo-300" size={48} />
              <p className="text-gray-600 font-medium">Belum ada data nilai yang diinput</p>
              <p className="text-gray-500 text-sm mt-1">Mulai dengan menambah nilai siswa</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Nama Siswa</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Mata Pelajaran</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Kompetensi</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Nilai</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Jenis Penilaian</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Tanggal</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {grades.map((grade) => (
                    <tr key={grade.id} className="hover:bg-indigo-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{grade.studentName}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{grade.subjectName}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{grade.competencyName}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-block px-4 py-2 rounded-full font-bold text-base ${getScoreBadgeColor(grade.score)}`}>
                          {grade.score}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {grade.assessmentType === 'DAILY' && 'Penilaian Harian'}
                        {grade.assessmentType === 'QUIZ' && 'Kuis'}
                        {grade.assessmentType === 'TASK' && 'Tugas'}
                        {grade.assessmentType === 'PROJECT' && 'Proyek'}
                        {grade.assessmentType === 'MIDTERM' && 'UTS'}
                        {grade.assessmentType === 'FINAL' && 'UAS'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{grade.date}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handleEdit(grade)}
                          className="bg-blue-100 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-200 transition-all font-medium text-sm inline-flex items-center gap-1"
                        >
                          <Edit size={16} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(grade.id)}
                          className="bg-red-100 text-red-700 px-3 py-2 rounded-lg hover:bg-red-200 transition-all font-medium text-sm inline-flex items-center gap-1"
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
                <span className="text-sm text-gray-600 font-medium">
                  Halaman <span className="text-indigo-600 font-bold">{page}</span> dari {totalPages || 1} ({total} total)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-sm"
                  >
                    <ChevronLeft size={16} />
                    Sebelumnya
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages || totalPages === 0}
                    className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-sm"
                  >
                    Selanjutnya
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
