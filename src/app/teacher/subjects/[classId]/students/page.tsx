'use client';

import { Fragment, useCallback, useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Users, X, AlertCircle, CheckCircle, ChevronDown, Edit2, Trash2, ChevronLeft, ChevronRight, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiFetch } from '@/lib/api-client';
import { devError } from '@/lib/dev-log';

interface Student {
  id: string;
  name: string;
  nisn?: string;
  studentNo: string;
  nourut?: number;
  email?: string;
  phone?: string;
  classId?: string;
  className?: string;
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

interface CompetenciesResponse {
  success: boolean;
  competencies?: Competency[];
  message?: string;
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

interface StudentListResponse {
  success: boolean;
  data?: Student[];
  total?: number;
  pagination?: { total?: number };
  message?: string;
}

interface ApprovedGradeResponseItem {
  competencyId?: string | null;
  assessmentType: string;
}

interface ErrorDetailItem {
  field: string;
  message: string;
}

interface ErrorResponse {
  error?: string;
  details?: ErrorDetailItem[];
}

interface ImportSheetRow {
  'Nomor Siswa'?: string;
  'Nama Siswa'?: string;
  'Nama Kompetensi'?: string;
  'Nilai (1-10)'?: string | number;
  'Jenis Penilaian'?: string;
  'Catatan'?: string;
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
  const [approvedGrades, setApprovedGrades] = useState<{ [key: string]: Set<string> }>({}); // Map of studentId -> Set of gradeIds
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

  const fetchClassInfo = useCallback(async () => {
    try {
      const classResponse = await apiFetch(`/api/admin/classes/${classId}`);
      const classData = await classResponse.json();
      if (classData.data?.name) {
        setClassName(classData.data.name);
      }

      if (subjectId) {
        const subjectResponse = await apiFetch(`/api/admin/subjects/${subjectId}`);
        const subjectData = await subjectResponse.json();
        if (subjectData.data?.name) {
          setSubjectName(subjectData.data.name);
        }
      }
    } catch (error) {
      devError('Error fetching info:', error);
    }
  }, [classId, subjectId]);

  const fetchClassStudents = useCallback(async () => {
    try {
      if (!classId || classId.trim() === '') {
        setError('ID Kelas tidak valid');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');

      const response = await apiFetch(`/api/admin/classes/${classId}/students?page=${currentPage}&limit=${itemsPerPage}`);

      const data: StudentListResponse = await response.json();

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
      devError('Error fetching students:', err);
      setError('Gagal memuat data siswa');
    } finally {
      setIsLoading(false);
    }
  }, [classId, currentPage]);

  const fetchCompetencies = useCallback(async (studentId?: string) => {
    void studentId;
    try {
      setCompetenciesLoading(true);

      const response = await apiFetch(`/api/teacher/competencies?subjectId=${subjectId}`);

      const data: CompetenciesResponse = await response.json();
      if (data.success && data.competencies) {
        setCompetencies(data.competencies);
      }
    } catch (error) {
      devError('Error fetching competencies:', error);
      setGradeError('Gagal memuat kompetensi');
    } finally {
      setCompetenciesLoading(false);
    }
  }, [subjectId]);

  const fetchApprovedGrades = useCallback(async (studentId: string) => {
    try {
      const response = await apiFetch(
        `/api/teacher/approved-grades?studentId=${studentId}&subjectId=${subjectId}`
      );

      const data = await response.json();
      if (data.success && data.data) {
        const approvedIds = new Set<string>((data.data as ApprovedGradeResponseItem[]).map((grade) => `${grade.competencyId}-${grade.assessmentType}`));
        setApprovedGrades((prev) => ({
          ...prev,
          [studentId]: approvedIds,
        }));
      }
    } catch (error) {
      devError('Error fetching approved grades:', error);
    }
  }, [subjectId]);

  const fetchStudentGrades = useCallback(async (studentId: string) => {
    try {
      setLoadingGrades((prev) => ({ ...prev, [studentId]: true }));

      const response = await apiFetch(
        `/api/teacher/grades?studentId=${studentId}&subjectId=${subjectId}&classId=${classId}`
      );

      const data = await response.json();
      if (data.success) {
        setGrades((prev) => {
          const updated = {
            ...prev,
            [studentId]: data.data || [],
          };
          return updated;
        });
        await fetchApprovedGrades(studentId);
      }
    } catch (error) {
      devError('Error fetching grades:', error);
    } finally {
      setLoadingGrades((prev) => ({ ...prev, [studentId]: false }));
    }
  }, [classId, fetchApprovedGrades, subjectId]);

  // Auto-refresh data when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void fetchClassStudents();
        void fetchClassInfo();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchClassInfo, fetchClassStudents]);

  // Clear grade form when subject changes
  useEffect(() => {
    setGradeFormData({
      competencyId: '',
      score: '',
      assessmentType: 'UTS_1',
      notes: '',
    });
    setGradeError('');
    setGradeSuccess('');
    setGrades({});
  }, [subjectId]);

  // Auto-select first student when page loads and student changes
  useEffect(() => {
    if (students.length > 0 && selectedStudent && !students.find((s) => s.id === selectedStudent.id)) {
      const firstStudent = students[0];
      setSelectedStudent(firstStudent);
      setEditingGradeId(null);
      setGradeFormData({
        competencyId: '',
        score: '',
        assessmentType: 'UTS_1',
        notes: '',
      });
      setGradeError('');
      void fetchCompetencies(firstStudent.id);
    }
  }, [fetchCompetencies, selectedStudent, students]);

  // Auto-load grades for all students
  useEffect(() => {
    if (students.length > 0) {
      students.forEach((student) => {
        if (!grades[student.id]) {
          void fetchStudentGrades(student.id);
        }
      });
    }
  }, [fetchStudentGrades, grades, students]);

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

      if (!selectedStudent) {
        setGradeError('Data siswa tidak valid');
        return;
      }

      const payload = {
        studentId: selectedStudent.id,
        competencyId: gradeFormData.competencyId,
        subjectId: subjectId, // Add subjectId to ensure data is for correct subject
        score: parseFloat(gradeFormData.score),
        assessmentType: gradeFormData.assessmentType,
        notes: gradeFormData.notes,
      };

      let response;
      if (editingGradeId) {
        response = await apiFetch(`/api/teacher/grades/${editingGradeId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } else {
        response = await apiFetch('/api/teacher/grades', {
          method: 'POST',
          headers: {
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
        // Auto clear success message after 3 seconds
        setTimeout(() => {
          setGradeSuccess('');
        }, 3000);
        // Fetch latest grades and ensure the list is expanded to show them
        await fetchStudentGrades(selectedStudent.id);
        // Ensure grades are expanded to show the new data
        if (expandedStudentId !== selectedStudent.id) {
          setExpandedStudentId(selectedStudent.id);
        }
      } else {
        let errorResponse: ErrorResponse = {};
        try {
          const text = await response.text();
          if (text) {
            errorResponse = JSON.parse(text);
          }
        } catch (parseError) {
          devError('Failed to parse error response:', parseError);
        }
        
        devError('Grade submission error:', errorResponse, response.status);
        
        // Handle 409 Conflict - grade has been approved
        if (response.status === 409) {
          setGradeError(errorResponse.error || 'Nilai ini sudah disetujui dan tidak dapat diubah.');
          setEditingGradeId(null);
          setGradeFormData({
            competencyId: '',
            score: '',
            assessmentType: 'UTS_1',
            notes: '',
          });
          // Refresh grades to get updated approved status
          if (selectedStudent) {
            await fetchStudentGrades(selectedStudent.id);
          }
          return;
        }
        
        // Handle field errors from validation
        if (errorResponse.details && Array.isArray(errorResponse.details)) {
          const fieldErrorMessages = errorResponse.details
            .map((err: ErrorDetailItem) => `${err.field}: ${err.message}`)
            .join(', ');
          setGradeError(`${errorResponse.error}: ${fieldErrorMessages}`);
        } else {
          setGradeError(errorResponse.error || `Gagal menyimpan nilai (Status: ${response.status})`);
        }
      }
    } catch (error) {
      devError('Error submitting grade:', error);
      setGradeError('Terjadi kesalahan saat menyimpan nilai');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditGrade = (grade: Grade, student: Student) => {
    const isApproved = isGradeApproved(grade, student.id);
    
    if (isApproved) {
      setGradeError('Nilai ini sudah disetujui dan tidak dapat diubah. Hubungi Wali Kelas untuk perubahan lebih lanjut.');
      return;
    }

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
      void fetchCompetencies(student.id);
    }
  };

  const handleDeleteGrade = async (gradeId: string, studentId: string) => {
    if (!confirm('Hapus nilai ini?')) return;

    try {
      const response = await apiFetch(`/api/teacher/grades/${gradeId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setGradeSuccess('Nilai berhasil dihapus');
        await fetchStudentGrades(studentId);
      } else {
        setGradeError('Gagal menghapus nilai');
      }
    } catch (error) {
      devError('Error deleting grade:', error);
      setGradeError('Terjadi kesalahan saat menghapus nilai');
    }
  };

  const isGradeApproved = (grade: Grade, studentId: string): boolean => {
    let key: string;
    if (grade.competencyId === null || grade.competencyId === '') {
      key = `null-${grade.assessmentType}`;
    } else {
      key = `${grade.competencyId}-${grade.assessmentType}`;
    }
    return Boolean(approvedGrades[studentId]?.has(key));
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

    const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    
    // Check boundary
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
    // Create rows with actual student data
    const templateRows = students.map((student) => ({
      'Nomor Siswa': student.nisn || student.studentNo || '',
      'Nama Siswa': student.name || '',
      'Nama Kompetensi': '', // Empty for user to fill
      'Nilai (1-10)': '', // Empty for user to fill
      'Jenis Penilaian': 'UTS_1', // Default value
      'Catatan': '', // Empty for user to fill
    }));

    const ws = XLSX.utils.json_to_sheet(templateRows);
    
    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 12 }, // Nomor Siswa
      { wch: 25 }, // Nama Siswa
      { wch: 25 }, // Nama Kompetensi
      { wch: 12 }, // Nilai
      { wch: 18 }, // Jenis Penilaian
      { wch: 20 }, // Catatan
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Nilai');
    XLSX.writeFile(wb, `Template_Nilai_${className}_${subjectName || 'Mata_Pelajaran'}.xlsx`);
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
      const jsonData = XLSX.utils.sheet_to_json<ImportSheetRow>(worksheet);

      if (jsonData.length === 0) {
        setImportError('File kosong atau tidak memiliki data');
        return;
      }

      // Parse and validate data
      const parsedRows: ImportGradeRow[] = jsonData.map((row, idx) => {
        const errors: string[] = [];
        const score = row['Nilai (1-10)'] ? parseFloat(String(row['Nilai (1-10)'])) : undefined;

        if (!row['Nomor Siswa']) errors.push('Nomor Siswa kosong');
        if (!row['Nama Siswa']) errors.push('Nama Siswa kosong');
        // Kompetensi adalah opsional, jadi tidak perlu validasi
        if (!score || isNaN(score) || score < 1 || score > 10) errors.push('Nilai harus 1-10');
        const assessmentType = row['Jenis Penilaian'] ? String(row['Jenis Penilaian']).trim() : '';
        if (!assessmentType) errors.push('Jenis Penilaian kosong');
        if (assessmentType && !Object.keys(assessmentTypeLabels).includes(assessmentType)) {
          errors.push(`Jenis Penilaian tidak valid: ${row['Jenis Penilaian']}`);
        }

        return {
          studentNo: String(row['Nomor Siswa']).trim(),
          studentName: String(row['Nama Siswa']).trim(),
          competencyName: row['Nama Kompetensi'] ? String(row['Nama Kompetensi']).trim() : '',
          score: score,
          assessmentType: String(row['Jenis Penilaian']).trim(),
          notes: row['Catatan'] ? String(row['Catatan']).trim() : '',
          rowIndex: idx + 2, // +2 because spreadsheet is 1-indexed and includes header
          errors: errors.length > 0 ? errors : undefined,
        };
      });

      setImportedRows(parsedRows);
    } catch (error) {
      devError('Error parsing file:', error);
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

    // Check for rows with errors
    const rowsWithErrors = importedRows.filter((row) => row.errors && row.errors.length > 0);
    if (rowsWithErrors.length > 0) {
      setImportError(`Ada ${rowsWithErrors.length} baris dengan error. Silakan perbaiki sebelum submit.`);
      return;
    }

    try {
      setImportSubmitting(true);
      setImportError('');

      // Create grade objects for submission
      const gradesToSubmit = importedRows.map((row) => ({
        studentNo: row.studentNo,
        competencyName: row.competencyName,
        score: row.score,
        assessmentType: row.assessmentType,
        notes: row.notes,
      }));

      // Send to API
      const response = await apiFetch(`/api/teacher/grades/import?subjectId=${subjectId}&classId=${classId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gradesToSubmit),
      });

      const data = await response.json();

      if (response.ok) {
        // Build success message with created/updated details
        let successMsg = '';
        if (data.createdCount && data.updatedCount) {
          successMsg = `${data.createdCount} nilai baru dibuat, ${data.updatedCount} nilai diperbarui`;
        } else if (data.createdCount) {
          successMsg = `${data.createdCount} nilai baru berhasil diimport`;
        } else if (data.updatedCount) {
          successMsg = `${data.updatedCount} nilai berhasil diperbarui`;
        } else {
          successMsg = `${data.successCount || importedRows.length} nilai berhasil diimport`;
        }
        setImportSuccess(successMsg);
        // Auto close modal after 2 seconds
        setTimeout(() => {
          setShowImportModal(false);
          setImportFile(null);
          setImportedRows([]);
          setImportError('');
        }, 2000);
        // Refresh data
        void fetchClassStudents();
        // Reload grades for all students
        students.forEach((student) => {
          void fetchStudentGrades(student.id);
        });
      } else {
        setImportError(data.error || 'Gagal mengimport nilai');
      }
    } catch (error) {
      devError('Error submitting import:', error);
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
                        {/* Column Layout: Name & NIM on left, Assessment Type & Score on right */}
                        <div className="flex gap-8">
                          <div className="flex-1">
                            {/* Student Info Column */}
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
                            <p className="text-sm text-gray-600 mt-1">{student.nisn || student.studentNo || '-'}</p>
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
                                <th className="px-4 py-2 text-left font-semibold text-gray-700 hidden">Kompetensi</th>
                                <th className="px-4 py-2 text-center font-semibold text-gray-700">Jenis Penilaian</th>
                                <th className="px-4 py-2 text-center font-semibold text-gray-700">Nilai</th>
                                <th className="px-4 py-2 text-left font-semibold text-gray-700">Catatan</th>
                                <th className="px-4 py-2 text-center font-semibold text-gray-700">Status</th>
                                <th className="px-4 py-2 text-center font-semibold text-gray-700">Aksi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {grades[student.id].map((grade) => {
                                const isApproved = isGradeApproved(grade, student.id);
                                return (
                                  <tr key={grade.id} className={`border-b border-gray-200 transition-colors ${isApproved ? 'bg-blue-50 hover:bg-blue-50' : 'hover:bg-white'}`}>
                                    <td className="px-4 py-3 font-medium text-gray-900 hidden">{grade.competencyName}</td>
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
                                    <td className="px-4 py-3 text-center">
                                      {isApproved ? (
                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                          ✓ Disetujui
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                                          Pending
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-center space-x-1">
                                      <button
                                        onClick={() => handleEditGrade(grade, student)}
                                        disabled={isApproved}
                                        className={`inline-flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                                          isApproved 
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                        }`}
                                        title={isApproved ? 'Nilai sudah disetujui, tidak bisa diedit' : 'Edit'}
                                      >
                                        <Edit2 size={16} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteGrade(grade.id, student.id)}
                                        disabled={isApproved}
                                        className={`inline-flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                                          isApproved 
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                                        }`}
                                        title={isApproved ? 'Nilai sudah disetujui, tidak bisa dihapus' : 'Hapus'}
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
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
              <span className="ml-2 text-gray-700 font-semibold">{totalStudents} siswa total</span>
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
                    {selectedStudent.nourut || getCurrentStudentIndex() + 1} dari {totalStudents} siswa
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
                  disabled={getCurrentStudentIndex() === 0}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-gray-700 px-3 py-2 rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2"
                  title="Siswa Sebelumnya"
                >
                  <ChevronLeft size={16} />
                  <span className="hidden sm:inline">Sebelumnya</span>
                </button>
                <button
                  onClick={() => handleNavigateStudent('next')}
                  disabled={getCurrentStudentIndex() === students.length - 1}
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
                  {/* Competency Select - HIDDEN */}
                  <div className="hidden">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Kompetensi <span className="text-gray-500 text-xs">(opsional)</span>
                    </label>
                    <select
                      value={gradeFormData.competencyId}
                      onChange={(e) => setGradeFormData({ ...gradeFormData, competencyId: e.target.value })}
                      disabled={competenciesLoading || !!editingGradeId}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">-- Kosongkan / Tanpa Kompetensi --</option>
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
                            assessmentType: 'UTS_1',
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
                          assessmentType: 'UTS_1',
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

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] overflow-y-auto w-full">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Import Nilai dari Excel</h2>
                <p className="text-sm text-gray-600 mt-2"><span className="font-semibold">Kelas:</span> {className} | <span className="font-semibold">Mata Pelajaran:</span> {subjectName}</p>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportedRows([]);
                  setImportError('');
                }}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Error Alert */}
              {importError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                  <AlertCircle size={20} />
                  {importError}
                </div>
              )}

              {/* File Upload */}
              {importedRows.length === 0 ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Upload File Excel (.xlsx)
                    </label>
                    {importFile && (
                      <p className="text-sm text-gray-600 mb-2">File dipilih: {importFile.name}</p>
                    )}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleImportFile}
                      disabled={importLoading}
                      className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800 font-medium mb-2">📋 Format Excel:</p>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Kolom 1: <strong>Nomor Stambuk</strong> (contoh: 387)</li>
                      <li>• Kolom 2: <strong>Nama Siswa</strong> (contoh: Fulan)</li>
                      <li>• Kolom 3: <strong>Nama Kompetensi</strong></li>
                      <li>• Kolom 4: <strong>Nilai (1-10)</strong> (contoh: 8.5)</li>
                      <li>• Kolom 5: <strong>Jenis Penilaian</strong> (UTS_1, UAS_1, UTS_2, UAS_2, FINAL_EXAM_1, FINAL_EXAM_2)</li>
                      <li>• Kolom 6: <strong>Catatan</strong> (opsional)</li>
                    </ul>
                  </div>

                  {importLoading && (
                    <div className="text-center py-8">
                      <p className="text-gray-500">Membaca file...</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <p className="text-emerald-800 font-medium">
                      ✓ {importedRows.filter((r) => !r.errors || r.errors.length === 0).length} dari {importedRows.length} baris valid
                    </p>
                  </div>

                  {/* Preview Table */}
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 border-b">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700">Baris</th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700">Nomor Siswa</th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700">Nama Siswa</th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700">Kompetensi</th>
                          <th className="px-4 py-2 text-center font-semibold text-gray-700">Nilai</th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700">Jenis Penilaian</th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importedRows.map((row) => (
                          <tr
                            key={row.rowIndex}
                            className={row.errors && row.errors.length > 0 ? 'bg-red-50 border-b' : 'border-b hover:bg-gray-50'}
                          >
                            <td className="px-4 py-2 text-gray-700 font-medium">{row.rowIndex}</td>
                            <td className="px-4 py-2 text-gray-700">{row.studentNo}</td>
                            <td className="px-4 py-2 text-gray-700">{row.studentName}</td>
                            <td className="px-4 py-2 text-gray-700 text-xs">{row.competencyName}</td>
                            <td className="px-4 py-2 text-center">
                              {row.score ? (
                                <span className="inline-block bg-emerald-100 text-emerald-800 font-semibold px-2 py-1 rounded">
                                  {row.score}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-gray-700 text-xs">{row.assessmentType}</td>
                            <td className="px-4 py-2">
                              {row.errors && row.errors.length > 0 ? (
                                <div className="text-xs text-red-700 space-y-1">
                                  {row.errors.map((err, idx) => (
                                    <div key={idx} className="bg-red-100 px-2 py-1 rounded">
                                      {err}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                                  ✓ Valid
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t p-6 flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportedRows([]);
                  setImportError('');
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
              >
                Batal
              </button>
              {importedRows.length > 0 && (
                <>
                  <button
                    onClick={() => {
                      setImportedRows([]);
                      setImportFile(null);
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Pilih File Lain
                  </button>
                  <button
                    onClick={handleSubmitImport}
                    disabled={
                      importSubmitting ||
                      importedRows.some((r) => r.errors && r.errors.length > 0)
                    }
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importSubmitting ? 'Uploading...' : 'Upload Nilai'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
