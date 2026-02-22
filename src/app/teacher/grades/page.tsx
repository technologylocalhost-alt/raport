'use client';

import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, BookOpen, AlertCircle, CheckCircle } from 'lucide-react';

interface Grade {
  id: string;
  studentId: string;
  studentName: string;
  studentNisn: string;
  className: string;
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
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterAssessmentType, setFilterAssessmentType] = useState('');
  const [availableClasses, setAvailableClasses] = useState<{ id: string; name: string }[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<{ id: string; name: string }[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);
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
    assessmentType: 'UTS_1',
    notes: '',
  });

  const limit = 10;
  const totalPages = Math.ceil(total / limit);

  useEffect(() => {
    fetchGrades();
  }, [page, search, filterClass, filterSubject, filterAssessmentType]);

  useEffect(() => {
    if (showForm && students.length === 0) {
      fetchOptions();
    }
  }, [showForm]);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  async function fetchGrades() {
    try {
      setLoading(true);
      setErrorMessage('');
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
        ...(filterClass && { classId: filterClass }),
        ...(filterSubject && { subjectId: filterSubject }),
        ...(filterAssessmentType && { assessmentType: filterAssessmentType }),
      });

      const response = await fetch(`/api/teacher/grades?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setGrades(data.data);
        setTotal(data.pagination?.total || 0);
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

  async function fetchFilterOptions() {
    try {
      setFilterLoading(true);
      const token = localStorage.getItem('accessToken');

      // Fetch classes and subjects filter options
      const response = await fetch('/api/teacher/grades/filter-options', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setAvailableClasses(data.classes || []);
        setAvailableSubjects(data.subjects || []);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    } finally {
      setFilterLoading(false);
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
    if (isNaN(score) || score < 1 || score > 10) {
      setErrorMessage('Nilai harus antara 1-10');
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
          setFormData({ studentId: '', competencyId: '', score: '', assessmentType: 'UTS_1', notes: '' });
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
    setFormData({ studentId: '', competencyId: '', score: '', assessmentType: 'UTS_1', notes: '' });
    setErrorMessage('');
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 8) return 'bg-green-500 text-white';
    if (score >= 6) return 'bg-yellow-500 text-white';
    return 'bg-red-500 text-white';
  };

  const getSelectedStudentName = () => {
    if (!students || students.length === 0) return '';
    return students.find((s) => s.id === formData.studentId)?.name || '';
  };

  const getSelectedCompetencyName = () => {
    if (!competencies || competencies.length === 0) return '';
    const comp = competencies.find((c) => c.id === formData.competencyId);
    return comp ? `${comp.subjectName} - ${comp.name}` : '';
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Input Nilai Siswa</h1>
        <p className="text-gray-600 text-sm mt-1">Kelola nilai siswa berdasarkan kompetensi dan jenis penilaian</p>
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
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-indigo-500 space-y-4">
          <label className="block text-sm font-semibold text-gray-900">Filter Nilai</label>
          
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-indigo-500" size={20} />
            <input
              type="text"
              placeholder="Masukkan nama siswa atau mata pelajaran..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all hover:border-gray-400 bg-white text-gray-900 font-medium"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Class Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase">Kelas</label>
              <select
                value={filterClass}
                onChange={(e) => {
                  setFilterClass(e.target.value);
                  setPage(1);
                }}
                disabled={filterLoading}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white text-gray-900 font-medium disabled:bg-gray-100"
              >
                <option value="">Semua Kelas</option>
                {availableClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase">Mata Pelajaran</label>
              <select
                value={filterSubject}
                onChange={(e) => {
                  setFilterSubject(e.target.value);
                  setPage(1);
                }}
                disabled={filterLoading}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white text-gray-900 font-medium disabled:bg-gray-100"
              >
                <option value="">Semua Mata Pelajaran</option>
                {availableSubjects.map((subj) => (
                  <option key={subj.id} value={subj.id}>
                    {subj.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Assessment Type Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase">Jenis Penilaian</label>
              <select
                value={filterAssessmentType}
                onChange={(e) => {
                  setFilterAssessmentType(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white text-gray-900 font-medium"
              >
                <option value="">Semua Jenis Penilaian</option>
                <option value="UTS_1">Ujian Tengah Semester 1 (UTS 1)</option>
                <option value="UAS_1">Ujian Akhir Semester 1 (UAS 1)</option>
                <option value="UTS_2">Ujian Tengah Semester 2 (UTS 2)</option>
                <option value="UAS_2">Ujian Akhir Semester 2 (UAS 2)</option>
                <option value="FINAL_EXAM_1">Ujian Akhir 1</option>
                <option value="FINAL_EXAM_2">Ujian Akhir 2</option>
              </select>
            </div>
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
                  {students && students.map((student) => (
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
                  {competencies && competencies.map((comp) => (
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
                  Nilai (1-10) <span className="text-red-500">*</span>
                </label>
                {formData.score && (
                  <p className="text-xs text-indigo-600 font-medium mb-2">Nilai saat ini: {formData.score}</p>
                )}
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="0.01"
                  placeholder="Contoh: 8.5"
                  value={formData.score}
                  onChange={(e) => setFormData({ ...formData, score: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Masukkan nilai antara 1-10 dengan desimal jika diperlukan</p>
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
                  <option value="UTS_1">Ujian Tengah Semester 1 (UTS 1)</option>
                  <option value="UAS_1">Ujian Akhir Semester 1 (UAS 1)</option>
                  <option value="UTS_2">Ujian Tengah Semester 2 (UTS 2)</option>
                  <option value="UAS_2">Ujian Akhir Semester 2 (UAS 2)</option>
                  <option value="FINAL_EXAM_1">Ujian Akhir 1</option>
                  <option value="FINAL_EXAM_2">Ujian Akhir 2</option>
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
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">No Stambuk</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Nama Siswa</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Kelas</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Mata Pelajaran</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Nilai</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Jenis Penilaian</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Tanggal</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {grades.map((grade) => (
                    <tr key={grade.id} className="hover:bg-indigo-50 transition-colors">
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                          {grade.studentNisn}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{grade.studentName}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          {grade.className}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{grade.subjectName}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-block px-4 py-2 rounded-full font-bold text-base ${getScoreBadgeColor(grade.score)}`}>
                          {grade.score}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {grade.assessmentType === 'UTS_1' && 'Ujian Tengah Semester 1 (UTS 1)'}
                        {grade.assessmentType === 'UAS_1' && 'Ujian Akhir Semester 1 (UAS 1)'}
                        {grade.assessmentType === 'UTS_2' && 'Ujian Tengah Semester 2 (UTS 2)'}
                        {grade.assessmentType === 'UAS_2' && 'Ujian Akhir Semester 2 (UAS 2)'}
                        {grade.assessmentType === 'FINAL_EXAM_1' && 'Ujian Akhir 1'}
                        {grade.assessmentType === 'FINAL_EXAM_2' && 'Ujian Akhir 2'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{grade.date}</td>
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
                    className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all font-medium text-sm"
                  >
                    <ChevronLeft size={16} />
                    Sebelumnya
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages || totalPages === 0}
                    className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all font-medium text-sm"
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
