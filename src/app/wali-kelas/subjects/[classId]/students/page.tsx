'use client';

import { Fragment, useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Users, PenTool, X, AlertCircle, CheckCircle, ChevronDown, Edit2, Trash2 } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  studentNo: string;
  email?: string;
  phone?: string;
  classId?: string;
}

interface Competency {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
}

interface Grade {
  id: string;
  competencyId: string;
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

export default function WaliKelasStudentsPage() {
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
  const [subjectName, setSubjectName] = useState('');
  
  // Grade input modal states
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
    fetchClassInfo();
  }, [classId]);

  async function fetchClassInfo() {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      // Get class name
      const classResponse = await fetch(`/api/admin/classes/${classId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const classData = await classResponse.json();
      if (classData.data?.name) {
        setClassName(classData.data.name);
      }

      // Get subject name
      if (subjectId) {
        const subjectResponse = await fetch(`/api/admin/subjects/${subjectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const subjectData = await subjectResponse.json();
        if (subjectData.data?.name) {
          setSubjectName(subjectData.data.name);
        }
      }
    } catch (error) {
      console.error('Error fetching info:', error);
    }
  }

  async function fetchClassStudents() {
    try {
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
      
      const response = await fetch(`/api/admin/classes/${classId}/students`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: ApiResponse = await response.json();

      console.log('Students fetched:', data);

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
        setStudents(data.data);
      } else {
        setStudents([]);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
      setError('Gagal memuat data siswa');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchCompetencies(studentId: string) {
    try {
      setCompetenciesLoading(true);
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`/api/teacher/competencies?subjectId=${subjectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data: CompetenciesResponse = await response.json();
      console.log('Competencies fetched:', data);
      if (data.success && data.competencies) {
        setCompetencies(data.competencies);
      }
    } catch (error) {
      console.error('Error fetching competencies:', error);
      setGradeError('Gagal memuat kompetensi');
    } finally {
      setCompetenciesLoading(false);
    }
  }

  async function fetchStudentGrades(studentId: string) {
    try {
      setLoadingGrades((prev) => ({ ...prev, [studentId]: true }));
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(
        `/api/teacher/grades?studentId=${studentId}&subjectId=${subjectId}&classId=${classId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await response.json();
      console.log('Grades fetched for student:', studentId, data);
      if (data.success) {
        console.log(`Setting ${data.data?.length || 0} grades for student ${studentId}`);
        setGrades((prev) => {
          const updated = {
            ...prev,
            [studentId]: data.data || [],
          };
          console.log('Grades state updated, new state:', updated);
          return updated;
        });
      }
    } catch (error) {
      console.error('Error fetching grades:', error);
    } finally {
      setLoadingGrades((prev) => ({ ...prev, [studentId]: false }));
    }
  }

  const handleOpenGradeModal = async (student: Student) => {
    setSelectedStudent(student);
    setEditingGradeId(null);
    setGradeFormData({
      competencyId: '',
      score: '',
      assessmentType: 'DAILY',
      notes: '',
    });
    setGradeError('');
    await fetchCompetencies(student.id);
  };

  const handleSubmitGrade = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!gradeFormData.competencyId || !gradeFormData.score) {
      setGradeError('Pilih kompetensi dan masukkan nilai');
      return;
    }

    const score = parseFloat(gradeFormData.score);
    if (isNaN(score) || score < 0 || score > 100) {
      setGradeError('Nilai harus antara 0-100');
      return;
    }

    try {
      setIsSubmitting(true);
      setGradeError('');
      const token = localStorage.getItem('accessToken');

      if (!token || !selectedStudent) {
        setGradeError('Token atau data siswa tidak valid');
        return;
      }

      const payload = {
        studentId: selectedStudent.id,
        competencyId: gradeFormData.competencyId,
        score: parseFloat(gradeFormData.score),
        assessmentType: gradeFormData.assessmentType,
        notes: gradeFormData.notes,
      };

      console.log('Submitting grade payload:', payload);

      let response;
      if (editingGradeId) {
        response = await fetch(`/api/teacher/grades/${editingGradeId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch('/api/teacher/grades', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      }

      if (response.ok) {
        console.log('Grade saved successfully, response status:', response.status);
        setGradeSuccess(editingGradeId ? 'Nilai berhasil diperbarui' : 'Nilai berhasil ditambahkan');
        setEditingGradeId(null);
        setGradeFormData({
          competencyId: '',
          score: '',
          assessmentType: 'DAILY',
          notes: '',
        });
        // Fetch latest grades and ensure the list is expanded to show them
        console.log('Fetching grades for student:', selectedStudent.id);
        await fetchStudentGrades(selectedStudent.id);
        // Ensure grades are expanded to show the new data
        console.log('Current expandedStudentId:', expandedStudentId, 'selected student id:', selectedStudent.id);
        if (expandedStudentId !== selectedStudent.id) {
          console.log('Setting expandedStudentId to:', selectedStudent.id);
          setExpandedStudentId(selectedStudent.id);
        }
      } else {
        const errorResponse = await response.json();
        console.error('Grade submission error:', errorResponse);
        
        // Handle field errors from validation
        if (errorResponse.details && Array.isArray(errorResponse.details)) {
          const fieldErrorMessages = errorResponse.details
            .map((err: any) => `${err.field}: ${err.message}`)
            .join(', ');
          setGradeError(`${errorResponse.error}: ${fieldErrorMessages}`);
        } else {
          setGradeError(errorResponse.error || 'Gagal menyimpan nilai');
        }
      }
    } catch (error) {
      console.error('Error submitting grade:', error);
      setGradeError('Terjadi kesalahan saat menyimpan nilai');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditGrade = (grade: Grade, student: Student) => {
    setSelectedStudent(student);
    setEditingGradeId(grade.id);
    setGradeFormData({
      competencyId: grade.competencyId,
      score: String(grade.score),
      assessmentType: grade.assessmentType,
      notes: grade.notes || '',
    });
    // Fetch competencies if not already loaded
    if (competencies.length === 0) {
      fetchCompetencies(student.id);
    }
  };

  const handleDeleteGrade = async (gradeId: string, studentId: string) => {
    if (!confirm('Hapus nilai ini?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`/api/teacher/grades/${gradeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setGradeSuccess('Nilai berhasil dihapus');
        await fetchStudentGrades(studentId);
      } else {
        setGradeError('Gagal menghapus nilai');
      }
    } catch (error) {
      console.error('Error deleting grade:', error);
      setGradeError('Terjadi kesalahan saat menghapus nilai');
    }
  };

  const toggleStudentGrades = (studentId: string) => {
    if (expandedStudentId === studentId) {
      setExpandedStudentId(null);
    } else {
      setExpandedStudentId(studentId);
      if (!grades[studentId]) {
        fetchStudentGrades(studentId);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {subjectName} - {className}
          </h1>
          <p className="text-gray-600 mt-1">Kelola nilai siswa</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
          <button onClick={() => setError('')} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Success Alert */}
      {gradeSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle size={20} />
          {gradeSuccess}
          <button onClick={() => setGradeSuccess('')} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Students List */}
        <div className={selectedStudent ? 'lg:col-span-2' : 'lg:col-span-3'}>
          {/* Students List */}
          {isLoading ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <p className="text-gray-500">Memuat data siswa...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <p className="text-yellow-800">Tidak ada siswa di kelas ini.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {students.map((student) => (
                <div key={student.id} className="bg-white rounded-lg shadow border">
                  {/* Student Row */}
                  <div
                    onClick={() => handleOpenGradeModal(student)}
                    className={`p-4 flex items-center justify-between cursor-pointer transition-all ${
                      selectedStudent?.id === student.id
                        ? 'bg-emerald-50 border-l-4 border-emerald-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="bg-emerald-100 p-3 rounded-full">
                        <Users size={20} className="text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{student.name}</p>
                        <p className="text-sm text-gray-600">{student.studentNo}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStudentGrades(student.id);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronDown
                        size={20}
                        className={`text-gray-600 transition-transform ${
                          expandedStudentId === student.id ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Grades List */}
                  {expandedStudentId === student.id && (
                    <div className="border-t bg-gray-50 p-4">
                      {loadingGrades[student.id] ? (
                        <p className="text-center text-gray-500">Memuat nilai...</p>
                      ) : grades[student.id] && grades[student.id].length > 0 ? (
                        <div className="space-y-3">
                          {grades[student.id].map((grade) => (
                            <div key={grade.id} className="bg-white p-3 rounded-lg border flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-gray-900">{grade.competencyName}</p>
                                <p className="text-sm text-gray-600">
                                  {getAssessmentTypeLabel(grade.assessmentType)} - {grade.score}
                                </p>
                                {grade.notes && <p className="text-sm text-gray-600 mt-1">{grade.notes}</p>}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditGrade(grade, student)}
                                  className="text-blue-600 hover:text-blue-900 p-2"
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button
                                  onClick={() => handleDeleteGrade(grade.id, student.id)}
                                  className="text-red-600 hover:text-red-900 p-2"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-gray-500">Belum ada nilai</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Grade Form */}
        {selectedStudent && (
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-4">
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{editingGradeId ? 'Edit Nilai' : 'Input Nilai'}</h2>
                  <p className="text-sm text-gray-600">{selectedStudent.name}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedStudent(null);
                    setEditingGradeId(null);
                    setGradeFormData({
                      competencyId: '',
                      score: '',
                      assessmentType: 'DAILY',
                      notes: '',
                    });
                  }}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-gray-600" />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-4">
                {gradeError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                    <AlertCircle size={16} />
                    {gradeError}
                  </div>
                )}

                <form onSubmit={handleSubmitGrade} className="space-y-4">
                  {/* Competency Select */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Kompetensi <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={gradeFormData.competencyId}
                      onChange={(e) => setGradeFormData({ ...gradeFormData, competencyId: e.target.value })}
                      disabled={competenciesLoading || !!editingGradeId}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                      required
                    >
                      <option value="">-- Pilih Kompetensi --</option>
                      {competencies.map((comp) => (
                        <option key={comp.id} value={comp.id}>
                          {comp.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Score Input */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Nilai (1-10) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={gradeFormData.score}
                      onChange={(e) => setGradeFormData({ ...gradeFormData, score: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 placeholder-gray-500"
                      placeholder="Masukkan nilai 1-10"
                      required
                    />
                  </div>

                  {/* Assessment Type */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Jenis Penilaian <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={gradeFormData.assessmentType}
                      onChange={(e) => setGradeFormData({ ...gradeFormData, assessmentType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 bg-white"
                    >
                      {Object.entries(assessmentTypeLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Catatan</label>
                    <textarea
                      value={gradeFormData.notes}
                      onChange={(e) => setGradeFormData({ ...gradeFormData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 placeholder-gray-500"
                      placeholder="Masukkan catatan (opsional)"
                      rows={3}
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-col gap-2 pt-4 border-t">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? 'Menyimpan...' : editingGradeId ? 'Update Nilai' : 'Simpan Nilai'}
                    </button>
                    {editingGradeId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGradeId(null);
                          setGradeFormData({
                            competencyId: '',
                            score: '',
                            assessmentType: 'DAILY',
                            notes: '',
                          });
                        }}
                        className="w-full bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                      >
                        Batal Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudent(null);
                        setEditingGradeId(null);
                        setGradeFormData({
                          competencyId: '',
                          score: '',
                          assessmentType: 'DAILY',
                          notes: '',
                        });
                      }}
                      className="w-full bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                    >
                      Tutup
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
