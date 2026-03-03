'use client';

import { Fragment, useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Users, PenTool, X, AlertCircle, CheckCircle, ChevronDown, Edit2, Trash2, ChevronLeft, ChevronRight, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Student {
  id: string;
  name: string;
  studentNo: string;
  nourut?: number;
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
  isApproved?: boolean;
}

interface ImportGradeRow {
  studentNo?: string;
  studentName?: string;
  competencyName?: string;
  score?: number | string;
  assessmentType?: string;
  notes?: string;
  rowIndex: number;
  errors?: string[];
}

export default function AdminPenilaianStudentsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const classId = params.classId as string;
  const subjectId = params.subjectId as string;

  // Validate required parameters
  useEffect(() => {
    if (!classId) {
      setError('ID Kelas tidak valid');
      return;
    }
    if (!subjectId) {
      setError('ID Mata Pelajaran tidak valid');
      return;
    }
  }, [classId, subjectId]);
  
  // Mapping assessment type to Indonesian labels
  const assessmentTypeLabels: { [key: string]: string } = {
    UTS_1: 'Ujian Tengah Semester 1 (UTS 1)',
    UAS_1: 'Ujian Akhir Semester 1 (UAS 1)',
    UTS_2: 'Ujian Tengah Semester 2 (UTS 2)',
    UAS_2: 'Ujian Akhir Semester 2 (UAS 2)',
    FINAL_EXAM_1: 'Ujian Akhir Siswa Akhir Gel 1',
    FINAL_EXAM_2: 'Ujian Akhir Siswa Gel 2',
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
    assessmentType: 'UTS_1',
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
  const [totalStudents, setTotalStudents] = useState(0);
  const itemsPerPage = 10;

  // Import Excel states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importedRows, setImportedRows] = useState<ImportGradeRow[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [importSubmitting, setImportSubmitting] = useState(false);

  useEffect(() => {
    fetchClassStudents();
    fetchClassInfo();
  }, [classId, currentPage]);

  // Auto-load grades for all students
  useEffect(() => {
    if (students.length > 0) {
      students.forEach((student) => {
        if (!grades[student.id]) {
          fetchStudentGrades(student.id);
        }
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
      
      const skip = (currentPage - 1) * itemsPerPage;
      const response = await fetch(`/api/admin/classes/${classId}/students?page=${currentPage}&limit=${itemsPerPage}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: any = await response.json();

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
        const total = data.pagination?.total || 0;
        setTotalStudents(total);
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

      const data: any = await response.json();
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
      if (data.success) {
        setGrades((prev) => {
          return {
            ...prev,
            [studentId]: data.data || [],
          };
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
      assessmentType: 'UTS_1',
      notes: '',
    });
    setGradeError('');
    await fetchCompetencies(student.id);
  };

  const handleSubmitGrade = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!gradeFormData.score) {
      setGradeError('Masukkan nilai');
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
        competencyId: gradeFormData.competencyId || null,
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
        setGradeSuccess(editingGradeId ? 'Nilai berhasil diperbarui' : 'Nilai berhasil ditambahkan');
        setEditingGradeId(null);
        setGradeFormData({
          competencyId: '',
          score: '',
          assessmentType: 'UTS_1',
          notes: '',
        });
        await fetchStudentGrades(selectedStudent.id);
        if (expandedStudentId !== selectedStudent.id) {
          setExpandedStudentId(selectedStudent.id);
        }
      } else {
        let errorResponse: any = {};
        try {
          const text = await response.text();
          if (text) {
            errorResponse = JSON.parse(text);
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
        }
        
        if (errorResponse.details && Array.isArray(errorResponse.details)) {
          const fieldErrorMessages = errorResponse.details
            .map((err: any) => `${err.field}: ${err.message}`)
            .join(', ');
          setGradeError(`${errorResponse.error}: ${fieldErrorMessages}`);
        } else {
          setGradeError(errorResponse.error || `Gagal menyimpan nilai (Status: ${response.status})`);
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

  const getCurrentStudentIndex = (): number => {
    if (!selectedStudent) return -1;
    return students.findIndex((s) => s.id === selectedStudent.id);
  };

  const handleNavigateStudent = async (direction: 'next' | 'prev') => {
    const currentIndex = getCurrentStudentIndex();
    if (currentIndex === -1) return;

    let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    
    // Check if we need to load next/previous page
    if (nextIndex < 0 && currentPage > 1) {
      // Go to previous page
      const prevPage = currentPage - 1;
      setCurrentPage(prevPage);
      return;
    }
    
    if (nextIndex >= students.length && currentPage < totalPages) {
      // Go to next page
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      return;
    }

    if (nextIndex < 0 || nextIndex >= students.length) return;

    const nextStudent = students[nextIndex];
    setSelectedStudent(nextStudent);
    setEditingGradeId(null);
    setGradeFormData({
      competencyId: '',
      score: '',
      assessmentType: 'UTS_1',
      notes: '',
    });
    setGradeError('');
    await fetchCompetencies(nextStudent.id);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        'Nomor Siswa': '387',
        'Nama Siswa': 'Faaiq Husain',
        'Nilai (1-10)': 8.5,
        'Jenis Penilaian': 'UTS_1',
        'Catatan': 'Bagus',
      },
      {
        'Nomor Siswa': '412',
        'Nama Siswa': 'Rayyan Aryatama Karim',
        'Nilai (1-10)': 7.0,
        'Jenis Penilaian': 'UTS_1',
        'Catatan': '',
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Nilai');
    XLSX.writeFile(wb, `Template_Nilai_${subjectName || 'Mata_Pelajaran'}.xlsx`);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportError('');
    setImportedRows([]);

    try {
      setImportLoading(true);
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        setImportError('File kosong atau tidak memiliki data');
        return;
      }

      const parsedRows: ImportGradeRow[] = jsonData.map((row, idx) => {
        const errors: string[] = [];
        const scoreValue = row['Nilai (1-10)'] ? parseFloat(String(row['Nilai (1-10)'])) : undefined;
        let score: number | undefined = undefined;
        
        if (scoreValue !== undefined && !isNaN(scoreValue)) {
          score = scoreValue;
        }

        if (!row['Nomor Siswa']) errors.push('Nomor Siswa kosong');
        if (!row['Nama Siswa']) errors.push('Nama Siswa kosong');
        if (!score || score < 1 || score > 10) errors.push('Nilai harus 1-10');
        if (!row['Jenis Penilaian']) errors.push('Jenis Penilaian kosong');
        if (!Object.keys(assessmentTypeLabels).includes(row['Jenis Penilaian'])) {
          errors.push(`Jenis Penilaian tidak valid: ${row['Jenis Penilaian']}`);
        }

        return {
          studentNo: String(row['Nomor Siswa']).trim(),
          studentName: String(row['Nama Siswa']).trim(),
          competencyName: row['Nama Kompetensi'] ? String(row['Nama Kompetensi']).trim() : '',
          score: score,
          assessmentType: String(row['Jenis Penilaian']).trim(),
          notes: row['Catatan'] ? String(row['Catatan']).trim() : '',
          rowIndex: idx + 2,
          errors: errors.length > 0 ? errors : undefined,
        };
      });

      setImportedRows(parsedRows);
    } catch (error) {
      console.error('Error parsing file:', error);
      setImportError('Error membaca file. Pastikan file adalah Excel (.xlsx)');
    } finally {
      setImportLoading(false);
    }
  };

  const handleSubmitImport = async () => {
    if (importedRows.length === 0) {
      setImportError('Tidak ada data untuk diimport');
      return;
    }

    const rowsWithErrors = importedRows.filter((row) => row.errors && row.errors.length > 0);
    if (rowsWithErrors.length > 0) {
      setImportError(`Ada ${rowsWithErrors.length} baris dengan error. Silakan perbaiki sebelum submit.`);
      return;
    }

    try {
      setImportSubmitting(true);
      setImportError('');
      const token = localStorage.getItem('accessToken');

      if (!token) {
        setImportError('Token tidak ditemukan');
        return;
      }

      const gradesToSubmit = importedRows.map((row) => ({
        studentNo: row.studentNo,
        competencyName: row.competencyName,
        score: row.score,
        assessmentType: row.assessmentType,
        notes: row.notes,
      }));

      const response = await fetch(`/api/teacher/grades/import?subjectId=${subjectId}&classId=${classId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gradesToSubmit),
      });

      const data = await response.json();

      if (response.ok) {
        setImportSuccess(`${data.successCount || importedRows.length} nilai berhasil diimport`);
        setShowImportModal(false);
        setImportFile(null);
        setImportedRows([]);
        setImportError('');
        fetchClassStudents();
        students.forEach((student) => {
          fetchStudentGrades(student.id);
        });
      } else {
        setImportError(data.error || 'Gagal mengimport nilai');
      }
    } catch (error) {
      console.error('Error submitting import:', error);
      setImportError('Terjadi kesalahan saat mengimport nilai');
    } finally {
      setImportSubmitting(false);
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

      {/* Success Alerts */}
      {gradeSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle size={20} />
          {gradeSuccess}
          <button onClick={() => setGradeSuccess('')} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

      {importSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle size={20} />
          {importSuccess}
          <button onClick={() => setImportSuccess('')} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => {
            setShowImportModal(true);
            setImportError('');
            setImportSuccess('');
            setImportFile(null);
            setImportedRows([]);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
        >
          <Upload size={20} />
          Import Nilai (Excel)
        </button>
        <button
          onClick={downloadTemplate}
          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2 font-medium"
        >
          <Download size={20} />
          Download Template
        </button>
      </div>

      {/* Main Content - Grid Layout */}
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
              <div key={student.id} className="bg-white rounded-lg shadow border overflow-hidden">
              {/* Student Header */}
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
                    <div className="flex gap-8">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {student.nourut && (
                            <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded min-w-fit">
                              #{student.nourut}
                            </span>
                          )}
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{student.name}</p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{student.studentNo}</p>
                      </div>
                      <div className="flex-1">
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

              {/* Grades List Detail */}
              {expandedStudentId === student.id && (
                <div className="border-t bg-gray-50 p-4">
                  {loadingGrades[student.id] ? (
                    <p className="text-center text-gray-500">Memuat nilai...</p>
                  ) : grades[student.id] && grades[student.id].length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-100">
                            <th className="px-4 py-2 text-center font-semibold text-gray-700">Jenis Penilaian</th>
                            <th className="px-4 py-2 text-center font-semibold text-gray-700">Nilai</th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Catatan</th>
                            <th className="px-4 py-2 text-center font-semibold text-gray-700">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grades[student.id].map((grade) => (
                            <tr key={grade.id} className="border-b border-gray-200 hover:bg-white">
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
                              <td className="px-4 py-3">
                                <p className="text-gray-600">{grade.notes || '-'}</p>
                              </td>
                              <td className="px-4 py-3 text-center flex gap-2 justify-center">
                                <button
                                  onClick={() => handleEditGrade(grade, student)}
                                  className="text-blue-600 hover:text-blue-700 transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button
                                  onClick={() => handleDeleteGrade(grade.id, student.id)}
                                  className="text-red-600 hover:text-red-700 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={18} />
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
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-medium"
          >
            Sebelumnya
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                page === currentPage
                  ? 'bg-emerald-600 text-white'
                  : 'border border-gray-300 hover:bg-gray-100 text-gray-900 font-medium'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-medium"
          >
            Selanjutnya
          </button>
        </div>
      )}
        </div>

        {/* Right: Grade Form Side Panel */}
        {selectedStudent && (
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-4">
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900">{editingGradeId ? 'Edit Nilai' : 'Input Nilai'}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedStudent.nourut && (
                      <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">
                        #{selectedStudent.nourut}
                      </span>
                    )}
                    <p className="text-sm text-gray-600 truncate">{selectedStudent.name}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {selectedStudent.studentNo}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedStudent(null);
                    setEditingGradeId(null);
                    setGradeFormData({
                      competencyId: '',
                      score: '',
                      assessmentType: 'UTS_1',
                      notes: '',
                    });
                  }}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                >
                  <X size={20} className="text-gray-600" />
                </button>
              </div>

              {/* Navigation Buttons */}
              <div className="flex gap-2 mb-4 pb-4 border-b">
                <button
                  onClick={() => handleNavigateStudent('prev')}
                  disabled={getCurrentStudentIndex() === 0 && currentPage === 1}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-gray-700 px-3 py-2 rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2"
                  title="Siswa Sebelumnya"
                >
                  <ChevronLeft size={16} />
                  <span className="hidden sm:inline">Sebelumnya</span>
                </button>
                <button
                  onClick={() => handleNavigateStudent('next')}
                  disabled={getCurrentStudentIndex() === students.length - 1 && currentPage === totalPages}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-gray-700 px-3 py-2 rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2"
                  title="Siswa Selanjutnya"
                >
                  <span className="hidden sm:inline">Selanjutnya</span>
                  <ChevronRight size={16} />
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
                  {/* Competency - Hidden */}
                  <div className="hidden">
                    <select
                      value={gradeFormData.competencyId}
                      onChange={(e) => setGradeFormData({ ...gradeFormData, competencyId: e.target.value })}
                    >
                      <option value="">-- Kosongkan / Tanpa Kompetensi --</option>
                      {competencies.map((comp) => (
                        <option key={comp.id} value={comp.id}>
                          {comp.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Score */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Nilai (1-10) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="10"
                    value={gradeFormData.score}
                    onChange={(e) => setGradeFormData({ ...gradeFormData, score: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900"
                    placeholder="Masukkan nilai"
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
                    placeholder="Catatan (opsional)"
                    rows={3}
                  />
                </div>

                {/* Buttons */}
                <div className="flex flex-col gap-2 pt-4 border-t">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 font-semibold"
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
                          assessmentType: 'UTS_1',
                          notes: '',
                        });
                      }}
                      className="w-full bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors font-medium"
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
                        assessmentType: 'UTS_1',
                        notes: '',
                      });
                    }}
                    className="w-full bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors font-medium"
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

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">Import Nilai dari Excel</h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportedRows([]);
                  setImportError('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              {importError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">
                  {importError}
                </div>
              )}

              {importSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-green-700 text-sm">
                  {importSuccess}
                </div>
              )}

              {!importFile ? (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleImportFile}
                      className="hidden"
                      id="importFile"
                    />
                    <label
                      htmlFor="importFile"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <Upload size={32} className="text-gray-400" />
                      <p className="font-semibold text-gray-900">Pilih atau drag file Excel</p>
                      <p className="text-sm text-gray-500">Atau klik untuk memilih file</p>
                    </label>
                  </div>

                  <button
                    onClick={downloadTemplate}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold flex items-center justify-center gap-2 text-gray-900"
                  >
                    <Download size={20} />
                    Download Template
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {importLoading ? (
                    <p className="text-center text-gray-500">Membaca file...</p>
                  ) : (
                    <>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="font-semibold text-blue-900">{importedRows.length} baris ditemukan</p>
                        {importedRows.filter((r) => r.errors).length > 0 && (
                          <p className="text-red-700 text-sm mt-1">
                            {importedRows.filter((r) => r.errors).length} baris dengan error
                          </p>
                        )}
                      </div>

                      <div className="max-h-96 overflow-y-auto border rounded-lg">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-100 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-gray-900 font-semibold">Nomor Siswa</th>
                              <th className="px-3 py-2 text-left text-gray-900 font-semibold">Nama</th>
                              <th className="px-3 py-2 text-center text-gray-900 font-semibold">Nilai</th>
                              <th className="px-3 py-2 text-left text-gray-900 font-semibold">Jenis Penilaian</th>
                              <th className="px-3 py-2 text-left text-gray-900 font-semibold">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importedRows.map((row, idx) => (
                              <tr key={idx} className={row.errors ? 'bg-red-50' : 'hover:bg-gray-50'}>
                                <td className="px-3 py-2 border-b text-gray-900">{row.studentNo}</td>
                                <td className="px-3 py-2 border-b text-gray-900">{row.studentName}</td>
                                <td className="px-3 py-2 border-b text-center font-semibold text-gray-900">{row.score}</td>
                                <td className="px-3 py-2 border-b text-gray-900">{row.assessmentType}</td>
                                <td className="px-3 py-2 border-b">
                                  {row.errors ? (
                                    <span className="text-red-700 font-semibold">Error</span>
                                  ) : (
                                    <span className="text-green-700 font-semibold">OK</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {importedRows.filter((r) => r.errors).length > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800 space-y-2">
                          <p className="font-semibold">Baris dengan error:</p>
                          {importedRows
                            .filter((r) => r.errors)
                            .map((row, idx) => (
                              <div key={idx} className="text-xs">
                                <p className="font-semibold">Baris {row.rowIndex}:</p>
                                <ul className="list-disc list-inside">
                                  {row.errors?.map((err, errIdx) => (
                                    <li key={errIdx}>{err}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setImportFile(null);
                            setImportedRows([]);
                            setImportError('');
                          }}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-900 font-medium"
                        >
                          Batal
                        </button>
                        <button
                          onClick={handleSubmitImport}
                          disabled={
                            importSubmitting ||
                            importedRows.filter((r) => r.errors).length > 0
                          }
                          className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {importSubmitting ? 'Mengimport...' : 'Simpan'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
