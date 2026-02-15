'use client';

import { Fragment, useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Users, PenTool, X, AlertCircle, CheckCircle, ChevronDown, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

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

export default function TeacherStudentsPage() {
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
    MIDTERM: 'UTS',
    FINAL: 'UAS',
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

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchClassStudents();
    fetchClassInfo();
  }, [classId, currentPage]);

  // Fetch grades for all students when they are loaded
  useEffect(() => {
    if (students.length > 0) {
      students.forEach((student) => {
        fetchStudentGrades(student.id);
      });
    }
  }, [students]);

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
      
      const response = await fetch(`/api/admin/classes/${classId}/students?page=${currentPage}&limit=${itemsPerPage}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: any = await response.json();

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
        // Get total pages from pagination info
        const total = data.pagination?.total || 0;
        setTotalPages(Math.ceil(total / itemsPerPage));
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
    if (isNaN(score) || score < 1 || score > 10) {
      setGradeError('Nilai harus antara 1-10 (boleh desimal, contoh: 5.5)');
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
        const error = await response.json();
        setGradeError(error.message || 'Gagal menyimpan nilai');
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
                      <div className="bg-emerald-100 p-3 rounded-full flex-shrink-0">
                        <Users size={20} className="text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        {/* Column Layout: Name & NIM on left, Assessment Type & Score on right */}
                        <div className="flex gap-8">
                          <div className="flex-1">
                            {/* Student Info Column */}
                            <p className="font-semibold text-gray-900">{student.name}</p>
                            <p className="text-sm text-gray-600 mt-1">{student.studentNo}</p>
                          </div>
                          <div className="flex-1">
                            {/* Grades Column - Grid layout */}
                            {grades[student.id] && grades[student.id].length > 0 ? (
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {grades[student.id].slice(0, 8).map((grade) => (
                                  <div key={grade.id} className="flex flex-col items-center text-center">
                                    <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded whitespace-nowrap">
                                      {getAssessmentTypeLabel(grade.assessmentType)}
                                    </span>
                                    <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded mt-1">
                                      {grade.score}
                                    </span>
                                  </div>
                                ))}
                                {grades[student.id].length > 8 && (
                                  <div className="flex items-center justify-center text-xs text-gray-600">
                                    +{grades[student.id].length - 8}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <>
                                <p className="text-xs text-gray-400">-</p>
                                <p className="text-xs text-gray-400 mt-1">-</p>
                              </>
                            )}
                          </div>
                        </div>
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
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 bg-gray-100">
                                <th className="px-4 py-2 text-left font-semibold text-gray-700">Kompetensi</th>
                                <th className="px-4 py-2 text-center font-semibold text-gray-700">Jenis Penilaian</th>
                                <th className="px-4 py-2 text-center font-semibold text-gray-700">Nilai</th>
                                <th className="px-4 py-2 text-left font-semibold text-gray-700">Catatan</th>
                                <th className="px-4 py-2 text-center font-semibold text-gray-700">Aksi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {grades[student.id].map((grade) => (
                                <tr key={grade.id} className="border-b border-gray-200 hover:bg-white transition-colors">
                                  <td className="px-4 py-3 font-medium text-gray-900">{grade.competencyName}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                      {getAssessmentTypeLabel(grade.assessmentType)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-emerald-100 text-emerald-800">
                                      {grade.score}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate" title={grade.notes}>
                                    {grade.notes || '-'}
                                  </td>
                                  <td className="px-4 py-3 text-center space-x-1">
                                    <button
                                      onClick={() => handleEditGrade(grade, student)}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteGrade(grade.id, student.id)}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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

          {/* Pagination */}
          <div className="flex justify-between items-center mt-6 bg-white p-4 rounded-lg shadow">
            <div className="text-sm font-medium text-gray-600">
              Halaman <span className="font-bold text-gray-900">{currentPage}</span> dari <span className="font-bold text-gray-900">{totalPages}</span> • 
              <span className="ml-2 text-gray-700 font-semibold">{students.length} siswa ditampilkan</span>
            </div>
            {totalPages > 1 && (
              <div className="flex gap-2 items-center">
                {/* Previous Button */}
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft size={20} className="text-gray-600" />
                </button>

                {/* Page Numbers */}
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    const isVisible = 
                      page === 1 || 
                      page === totalPages || 
                      Math.abs(page - currentPage) <= 1;
                    
                    if (!isVisible && page !== 2 && page !== totalPages - 1) {
                      return null;
                    }

                    if (!isVisible) {
                      return (
                        <span key={`dots-${page}`} className="px-2 text-gray-400">...</span>
                      );
                    }

                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 rounded-lg transition-colors ${
                          currentPage === page
                            ? 'bg-emerald-600 text-white font-semibold'
                            : 'border border-gray-300 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                {/* Next Button */}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Halaman Berikutnya"
                >
                  <ChevronRight size={20} className="text-gray-600" />
                </button>
              </div>
            )}
          </div>
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
                      step="0.1"
                      value={gradeFormData.score}
                      onChange={(e) => setGradeFormData({ ...gradeFormData, score: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 placeholder-gray-500"
                      placeholder="Contoh: 5.5 atau 7"
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
