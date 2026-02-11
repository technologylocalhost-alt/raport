'use client';

import { Fragment, useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Users, PenTool, X, AlertCircle, CheckCircle, ChevronDown, Edit2, Trash2 } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  nisn: string;
  className: string;
  email?: string;
  phone?: string;
}

interface Competency {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
}

interface Grade {
  id: string;
  competencyName: string;
  competencyCode?: string;
  score: number;
  assessmentType: string;
  notes?: string;
  createdAt: string;
}

interface ApiResponse {
  success: boolean;
  data?: Student[];
  message?: string;
}

interface CompetenciesResponse {
  success: boolean;
  competencies?: Competency[];
  message?: string;
}

export default function ClassStudentsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const classId = params.classId as string;
  const subjectId = searchParams.get('subjectId');

  // Validate required parameters
  useEffect(() => {
    if (!classId) {
      setError('ID Kelas tidak valid');
      return;
    }
    if (!subjectId) {
      setError('ID Mata Pelajaran diperlukan');
      return;
    }
  }, [classId, subjectId]);
  
  // Mapping assessment type to Indonesian labels
  const assessmentTypeLabels: { [key: string]: string } = {
    DAILY: 'Harian',
    QUIZ: 'Kuis',
    TASK: 'Tugas',
    PROJECT: 'Proyek',
    MIDTERM: 'Tengah Semester',
    FINAL: 'Akhir Semester',
  };

  const getAssessmentTypeLabel = (type: string): string => {
    return assessmentTypeLabels[type] || type;
  };
  
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [className, setClassName] = useState('');
  
  // Grade input modal states
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [competenciesLoading, setCompetenciesLoading] = useState(false);
  const [gradeError, setGradeError] = useState('');
  const [gradeSuccess, setGradeSuccess] = useState('');
  const [gradeFormData, setGradeFormData] = useState({
    competencyId: '',
    score: '',
    assessmentType: 'DAILY',
    notes: '',
  });
  const [editingGradeId, setEditingGradeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Grades states
  const [grades, setGrades] = useState<{ [key: string]: Grade[] }>({});
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [loadingGrades, setLoadingGrades] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchClassStudents();
  }, [classId]);

  async function fetchClassStudents() {
    try {
      // Validate classId format
      if (!classId || classId.trim() === '') {
        setError('ID Kelas tidak valid');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('accessToken');

      if (!token) {
        setError('Token tidak ditemukan. Silakan login kembali');
        setIsLoading(false);
        return;
      }
      
      const response = await fetch(`/api/teacher/classes/${classId}/students`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: ApiResponse = await response.json();

      if (response.status === 401) {
        setError('Anda tidak terautentikasi. Silakan login kembali');
        return;
      }

      if (response.status === 403) {
        setError('Anda tidak memiliki akses ke kelas ini');
        return;
      }

      if (response.status === 404) {
        setError('Kelas tidak ditemukan');
        return;
      }
      
      if (data.success && data.data) {
        // Validate response data
        if (!Array.isArray(data.data)) {
          setError('Format data siswa tidak valid');
          return;
        }
        
        setStudents(data.data);
        // Try to get class name from first student if available
        if (data.data.length > 0 && data.data[0].className) {
          setClassName(data.data[0].className);
        }
      } else {
        setError(data.message || 'Gagal memuat data siswa');
      }
    } catch (error) {
      console.error('Failed to fetch students:', error);
      setError('Terjadi kesalahan saat memuat data siswa. Periksa koneksi Anda');
    } finally {
      setIsLoading(false);
    }
  }

  const fetchStudentGrades = async (studentId: string) => {
    try {
      setLoadingGrades((prev) => ({ ...prev, [studentId]: true }));
      const token = localStorage.getItem('accessToken');
      
      const url = `/api/teacher/students/${studentId}/grades${subjectId ? `?subjectId=${subjectId}` : ''}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      
      if (data.success && data.grades) {
        setGrades((prev) => ({ ...prev, [studentId]: data.grades }));
      }
    } catch (error) {
      console.error('Failed to fetch grades:', error);
    } finally {
      setLoadingGrades((prev) => ({ ...prev, [studentId]: false }));
    }
  };

  const handleToggleGrades = async (studentId: string) => {
    if (expandedStudentId === studentId) {
      setExpandedStudentId(null);
    } else {
      setExpandedStudentId(studentId);
      // Fetch grades if not already loaded
      if (!grades[studentId]) {
        await fetchStudentGrades(studentId);
      }
    }
  };

  const handleOpenGradeModal = (student: Student) => {
    setSelectedStudent(student);
    setEditingGradeId(null);
    setGradeFormData({
      competencyId: '',
      score: '',
      assessmentType: 'DAILY',
      notes: '',
    });
    setGradeError('');
    setGradeSuccess('');
    setShowGradeModal(true);
    // Fetch competencies when opening modal
    fetchCompetencies();
  };

  const handleEditGrade = (student: Student, grade: Grade) => {
    setSelectedStudent(student);
    setEditingGradeId(grade.id);
    setGradeFormData({
      competencyId: '', // Not needed for edit, will be hidden
      score: String(grade.score),
      assessmentType: grade.assessmentType,
      notes: grade.notes || '',
    });
    setGradeError('');
    setGradeSuccess('');
    setShowGradeModal(true);
    // Fetch competencies when opening modal
    fetchCompetencies();
  };

  const handleDeleteGrade = async (gradeId: string, studentId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus nilai ini?')) {
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setGradeError('Sesi Anda telah berakhir. Silakan login kembali');
        return;
      }

      const response = await fetch(`/api/teacher/grades/${gradeId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Remove from local state
        setGrades((prev) => ({
          ...prev,
          [studentId]: prev[studentId].filter((g) => g.id !== gradeId),
        }));
        // Refresh grades
        await fetchStudentGrades(studentId);
      } else {
        const data = await response.json();
        alert('Gagal menghapus nilai: ' + (data.message || 'Kesalahan server'));
      }
    } catch (error) {
      console.error('Error deleting grade:', error);
      alert('Terjadi kesalahan saat menghapus nilai');
    }
  };

  const fetchCompetencies = async () => {
    try {
      // Validation: Check if subjectId exists
      if (!subjectId || subjectId.trim() === '') {
        setGradeError('ID Mata Pelajaran tidak valid. Silakan kembali dan pilih mata pelajaran');
        return;
      }

      setCompetenciesLoading(true);
      const token = localStorage.getItem('accessToken');

      if (!token) {
        setGradeError('Sesi Anda telah berakhir. Silakan login kembali');
        return;
      }
      
      // Use subject-specific competencies endpoint
      const endpoint = `/api/teacher/subjects/${subjectId}/competencies`;
      
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Handle different response statuses
      if (response.status === 401) {
        setGradeError('Sesi Anda telah berakhir. Silakan login kembali');
        return;
      }

      if (response.status === 403) {
        setGradeError('Anda tidak memiliki akses untuk mata pelajaran ini');
        return;
      }

      if (response.status === 404) {
        setGradeError('Mata Pelajaran tidak ditemukan');
        return;
      }

      const data: any = await response.json();
      
      // Validation: Check response format
      if (data.success) {
        const competenciesList = data.competencies;
        if (Array.isArray(competenciesList)) {
          setCompetencies(competenciesList);
        } else {
          setGradeError('Format data kompetensi tidak valid');
        }
      } else {
        setGradeError(data.message || 'Gagal memuat data kompetensi');
      }
    } catch (error) {
      console.error('Failed to fetch competencies:', error);
      setGradeError('Terjadi kesalahan saat memuat kompetensi. Periksa koneksi Anda');
    } finally {
      setCompetenciesLoading(false);
    }
  };

  const handleGradeFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGradeError('');
    setGradeSuccess('');
    setIsSubmitting(true);

    // Validation: Check required fields
    if (!editingGradeId && !gradeFormData.competencyId) {
      setGradeError('Mohon pilih kompetensi');
      setIsSubmitting(false);
      return;
    }

    if (!gradeFormData.score) {
      setGradeError('Mohon masukkan nilai');
      setIsSubmitting(false);
      return;
    }

    if (!gradeFormData.assessmentType) {
      setGradeError('Mohon pilih jenis penilaian');
      setIsSubmitting(false);
      return;
    }

    // Validation: Check student selection
    if (!selectedStudent || !selectedStudent.id) {
      setGradeError('Data siswa tidak valid');
      setIsSubmitting(false);
      return;
    }

    // Validation: Score format and range
    const score = parseFloat(gradeFormData.score);
    if (isNaN(score)) {
      setGradeError('Nilai harus berupa angka');
      setIsSubmitting(false);
      return;
    }

    if (score < 1 || score > 10) {
      setGradeError('Nilai harus antara 1-10');
      setIsSubmitting(false);
      return;
    }

    // Validation: Check token exists
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setGradeError('Sesi Anda telah berakhir. Silakan login kembali');
      setIsSubmitting(false);
      return;
    }

    try {
      // If editing, use PUT; otherwise use POST
      const isEditing = !!editingGradeId;
      const url = isEditing ? `/api/teacher/grades/${editingGradeId}` : '/api/teacher/grades';
      const method = isEditing ? 'PUT' : 'POST';

      const requestBody = isEditing
        ? {
            score: score,
            assessmentType: gradeFormData.assessmentType,
            notes: gradeFormData.notes,
          }
        : {
            studentId: selectedStudent?.id,
            competencyId: gradeFormData.competencyId,
            score: score,
            assessmentType: gradeFormData.assessmentType,
            notes: gradeFormData.notes,
          };

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      // Handle different response statuses
      if (response.status === 401) {
        setGradeError('Sesi Anda telah berakhir. Silakan login kembali');
        setIsSubmitting(false);
        return;
      }

      if (response.status === 403) {
        setGradeError('Anda tidak memiliki akses untuk mengubah nilai ini');
        setIsSubmitting(false);
        return;
      }

      if (response.status === 404) {
        setGradeError('Nilai atau siswa tidak ditemukan');
        setIsSubmitting(false);
        return;
      }

      if (response.ok && data.success) {
        setGradeSuccess(isEditing ? 'Nilai berhasil diperbarui' : 'Nilai berhasil disimpan');
        setTimeout(() => {
          setShowGradeModal(false);
          setSelectedStudent(null);
          setEditingGradeId(null);
          setGradeFormData({ competencyId: '', score: '', assessmentType: 'DAILY', notes: '' });
          // Refresh the grades list
          if (selectedStudent) {
            fetchStudentGrades(selectedStudent.id);
          }
          fetchClassStudents();
        }, 1500);
      } else {
        setGradeError(data.message || 'Gagal menyimpan nilai. Periksa kembali data Anda');
      }
    } catch (error) {
      console.error('Error saving grade:', error);
      setGradeError('Terjadi kesalahan saat menyimpan nilai. Periksa koneksi Anda');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Memuat data siswa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Daftar Siswa Kelas {className}</h1>
          <p className="text-gray-600 text-sm mt-1">Lihat semua siswa di kelas ini</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Students Table */}
        <div className={showGradeModal && selectedStudent ? 'lg:col-span-2' : 'lg:col-span-3'}>
          {isLoading ? (
            <div className="flex items-center justify-center min-h-96">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 font-medium">Memuat data siswa...</p>
              </div>
            </div>
          ) : !isLoading && students.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="bg-blue-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Users className="text-blue-600" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Siswa</h3>
              <p className="text-gray-600">Kelas ini belum memiliki siswa terdaftar.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  {/* Table Head */}
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        No.
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Nama Siswa
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        NISN
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Telepon
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Nilai
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  {/* Table Body */}
                  <tbody className="divide-y divide-gray-200">
                    {students.map((student, index) => (
                      <Fragment key={student.id}>
                        <tr key={student.id} className={`hover:bg-gray-50 transition-colors ${selectedStudent?.id === student.id ? 'bg-indigo-50' : ''}`}>
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">{index + 1}</td>
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">{student.name}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {student.nisn}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{student.email || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{student.phone || '-'}</td>
                          <td className="px-6 py-4 text-sm">
                            <button
                              onClick={() => handleToggleGrades(student.id)}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded hover:bg-amber-200 transition-colors whitespace-nowrap"
                            >
                              <span className="font-bold">{grades[student.id]?.length || 0}</span>
                              Nilai
                              <ChevronDown size={14} className={`transition-transform ${expandedStudentId === student.id ? 'rotate-180' : ''}`} />
                            </button>
                          </td>
                          <td className="px-6 py-4 text-sm text-center">
                            <button
                              onClick={() => handleOpenGradeModal(student)}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 transition-colors whitespace-nowrap"
                            >
                              <PenTool size={14} />
                              Input Nilai
                            </button>
                          </td>
                        </tr>
                        {/* Expanded Row - Nilai Details */}
                        {expandedStudentId === student.id && (
                          <tr className="bg-amber-50 border-t-2 border-b border-amber-200">
                            <td colSpan={7} className="px-6 py-4">
                              {loadingGrades[student.id] ? (
                                <div className="flex items-center gap-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600"></div>
                                  <span className="text-sm text-gray-600">Memuat nilai...</span>
                                </div>
                              ) : grades[student.id] && grades[student.id].length > 0 ? (
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-gray-900 mb-3">Daftar Nilai ({grades[student.id].length})</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {grades[student.id].map((grade) => (
                                      <div key={grade.id} className="bg-white p-3 rounded border border-amber-200">
                                        <div className="flex justify-between items-start gap-2 mb-2">
                                          <div className="flex-1">
                                            <p className="font-medium text-gray-900 text-sm">{grade.competencyName}</p>
                                            {grade.competencyCode && (
                                              <p className="text-xs text-gray-500">{grade.competencyCode}</p>
                                            )}
                                          </div>
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                                            {grade.score}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-gray-600 mb-2">
                                          <span>{getAssessmentTypeLabel(grade.assessmentType)}</span>
                                          <span>{new Date(grade.createdAt).toLocaleDateString('id-ID')}</span>
                                        </div>
                                        {grade.notes && (
                                          <p className="text-xs text-gray-600 mb-2 italic">"{grade.notes}"</p>
                                        )}
                                        <div className="flex gap-2 pt-2 border-t border-amber-100">
                                          <button
                                            onClick={() => handleEditGrade(student, grade)}
                                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded hover:bg-blue-200 transition-colors"
                                          >
                                            <Edit2 size={12} />
                                            Edit
                                          </button>
                                          <button
                                            onClick={() => handleDeleteGrade(grade.id, student.id)}
                                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded hover:bg-red-200 transition-colors"
                                          >
                                            <Trash2 size={12} />
                                            Hapus
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-600 italic">Belum ada nilai yang diinput</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Summary */}
          {students.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-center justify-between mt-6">
              <span className="font-medium">Total Siswa: <strong>{students.length}</strong></span>
              <span className="text-sm">Kelas {className} memiliki {students.length} siswa</span>
            </div>
          )}
        </div>

        {/* Right Column - Grade Input Form */}
        {showGradeModal && selectedStudent && (
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow sticky top-6">
              {/* Form Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">
                  {editingGradeId ? 'Edit Nilai' : 'Input Nilai'}
                </h3>
                <button
                  onClick={() => {
                    setShowGradeModal(false);
                    setSelectedStudent(null);
                    setEditingGradeId(null);
                  }}
                  className="text-white hover:bg-indigo-800 p-1 rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleGradeFormSubmit} className="p-6 space-y-4">
                {/* Error Alert */}
                {gradeError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-3">
                    <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{gradeError}</span>
                  </div>
                )}

                {/* Success Alert */}
                {gradeSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-start gap-3">
                    <CheckCircle size={18} className="flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{gradeSuccess}</span>
                  </div>
                )}

                {/* Student Info */}
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 uppercase font-semibold">Siswa Terpilih</p>
                  <p className="text-sm font-medium text-blue-900 mt-1">{selectedStudent.name}</p>
                  <p className="text-xs text-blue-700 mt-1">NISN: {selectedStudent.nisn}</p>
                </div>

                {/* Competency Selection - Hidden when editing */}
                {!editingGradeId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kompetensi <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={gradeFormData.competencyId}
                      onChange={(e) => setGradeFormData({ ...gradeFormData, competencyId: e.target.value })}
                      disabled={competenciesLoading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900 disabled:bg-gray-100"
                    >
                      <option value="">
                        {competenciesLoading ? 'Memuat...' : 'Pilih kompetensi'}
                      </option>
                      {competencies.map((comp) => (
                        <option key={comp.id} value={comp.id}>
                          {comp.subjectName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Score Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nilai (1-10) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="0.01"
                    value={gradeFormData.score}
                    onChange={(e) => setGradeFormData({ ...gradeFormData, score: e.target.value })}
                    placeholder="Contoh: 8.5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">Masukkan nilai antara 1-10</p>
                </div>

                {/* Assessment Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jenis Penilaian <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={gradeFormData.assessmentType}
                    onChange={(e) => setGradeFormData({ ...gradeFormData, assessmentType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                  >
                    <option value="DAILY">Harian</option>
                    <option value="QUIZ">Kuis</option>
                    <option value="TASK">Tugas</option>
                    <option value="PROJECT">Proyek</option>
                    <option value="MIDTERM">Tengah Semester</option>
                    <option value="FINAL">Akhir Semester</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Catatan
                  </label>
                  <textarea
                    value={gradeFormData.notes}
                    onChange={(e) => setGradeFormData({ ...gradeFormData, notes: e.target.value })}
                    placeholder="Masukkan catatan (opsional)"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowGradeModal(false);
                      setSelectedStudent(null);
                      setEditingGradeId(null);
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={competenciesLoading || isSubmitting || (editingGradeId === null && !gradeFormData.competencyId)}
                    className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm disabled:bg-gray-400"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Menyimpan...
                      </span>
                    ) : editingGradeId ? (
                      'Perbarui Nilai'
                    ) : (
                      'Simpan'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
