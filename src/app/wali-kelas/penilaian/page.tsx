'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Filter, Download, CheckCircle2 } from 'lucide-react';
import ApprovalModal from './ApprovalModal';

interface Grade {
  id: string;
  studentName: string;
  studentNo: string;
  studentNourut?: number;
  className: string;
  competencyName: string;
  subjectName: string;
  score: string;
  assessmentType: string;
  teacherName: string;
  isApproved?: boolean;
}

interface GradesSummary {
  studentName: string;
  studentNo: string;
  studentNourut?: number;
  className: string;
  subject: string;
  [key: string]: string | number | undefined; // For dynamic assessment type columns
}

export default function PenilaianPage() {
  const router = useRouter();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [filteredGrades, setFilteredGrades] = useState<Grade[]>([]);
  const [gradesSummary, setGradesSummary] = useState<GradesSummary[]>([]);
  const [approvedGrades, setApprovedGrades] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [selectedAssessmentType, setSelectedAssessmentType] = useState<string>('');
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [classStudents, setClassStudents] = useState<Array<{name: string, no: string, nourut?: number}>>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [classNameToIdMap, setClassNameToIdMap] = useState<{[key: string]: string}>({});
  const [classSubjects, setClassSubjects] = useState<Array<{id: string, name: string, code: string}>>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);

  const classes = Array.from(new Set(grades.map((g) => g.className))).sort();
  const subjects = Array.from(
    new Set(
      selectedClass
        ? grades.filter((g) => g.className === selectedClass).map((g) => g.subjectName)
        : grades.map((g) => g.subjectName)
    )
  ).sort();
  const students = Array.from(
    new Set(
      selectedClass
        ? grades
            .filter((g) => g.className === selectedClass)
            .map((g) => JSON.stringify({ name: g.studentName, no: g.studentNo }))
        : grades.map((g) => JSON.stringify({ name: g.studentName, no: g.studentNo }))
    )
  )
    .map((s) => JSON.parse(s))
    .sort((a, b) => a.name.localeCompare(b.name));
  
  const assessmentTypes = [
    { code: 'UTS_1', label: 'Ujian Tengah Semester 1 (UTS 1)' },
    { code: 'UAS_1', label: 'Ujian Akhir Semester 1 (UAS 1)' },
    { code: 'UTS_2', label: 'Ujian Tengah Semester 2 (UTS 2)' },
    { code: 'UAS_2', label: 'Ujian Akhir Semester 2 (UAS 2)' },
    { code: 'FINAL_EXAM_1', label: 'Ujian Akhir Siswa Akhir Gel 1' },
    { code: 'FINAL_EXAM_2', label: 'Ujian Akhir Siswa Gel 2' },
  ].filter((type) => {
    const relevantGrades = selectedClass 
      ? grades.filter((g) => g.className === selectedClass)
      : grades;
    return relevantGrades.some((g) => g.assessmentType === type.code);
  });

  useEffect(() => {
    fetchGrades();
  }, []);

  useEffect(() => {
    // Jika belum memilih kelas, jangan tampilkan data
    if (!selectedClass) {
      setFilteredGrades([]);
      return;
    }

    let filtered = [...grades];
    console.log(`[filter effect] Total grades: ${filtered.length}`);

    if (selectedClass) {
      filtered = filtered.filter((g) => g.className === selectedClass);
      console.log(`[filter effect] After class filter: ${filtered.length}`);
    }

    if (selectedSubject) {
      filtered = filtered.filter((g) => g.subjectName === selectedSubject);
    }

    if (selectedStudent) {
      filtered = filtered.filter((g) => g.studentNo === selectedStudent);
    }

    if (selectedAssessmentType) {
      console.log(`[filter effect] Filtering by assessment type: ${selectedAssessmentType}`);
      filtered = filtered.filter((g) => g.assessmentType === selectedAssessmentType);
      console.log(`[filter effect] After assessment type filter: ${filtered.length}`);
    }

    console.log(`[filter effect] Final filtered: ${filtered.length}, selectedAssessmentType: ${selectedAssessmentType}`);
    setFilteredGrades(filtered);
  }, [grades, selectedClass, selectedSubject, selectedStudent, selectedAssessmentType]);

  useEffect(() => {
    setGradesSummary(createSummary());
  }, [filteredGrades, classStudents, classSubjects, selectedClass, selectedAssessmentType, selectedStudent, selectedSubject]);

  useEffect(() => {
    // Fetch all students for the selected class
    if (!selectedClass) {
      setClassStudents([]);
      setClassSubjects([]);
      return;
    }

    fetchStudentsForClass();
    fetchClassSubjects();
  }, [selectedClass, classNameToIdMap]);

  async function fetchStudentsForClass() {
    if (!selectedClass || !classNameToIdMap[selectedClass]) {
      console.log(`[fetchStudentsForClass] selectedClass: ${selectedClass}, mapping exists: ${!!classNameToIdMap[selectedClass]}`);
      return;
    }

    try {
      setIsLoadingStudents(true);
      const token = localStorage.getItem('accessToken');
      const classId = classNameToIdMap[selectedClass];
      console.log(`[fetchStudentsForClass] Fetching students for classId: ${classId}`);

      const response = await fetch(
        `/api/wali-kelas/students?classId=${classId}&limit=1000`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const students = (data.data || []).map((s: any) => ({
          name: s.name,
          no: s.nisn,
          nourut: s.nourut,
        }));
        console.log(`[fetchStudentsForClass] Fetched ${students.length} students`);
        setClassStudents(students.sort((a: any, b: any) => a.name.localeCompare(b.name)));
      } else {
        console.error(`[fetchStudentsForClass] Error: ${response.status}`);
      }
      setIsLoadingStudents(false);
    } catch (err) {
      console.error('Error fetching students:', err);
      setIsLoadingStudents(false);
    }
  }

  async function fetchClassSubjects() {
    if (!selectedClass || !classNameToIdMap[selectedClass]) {
      console.log(`[fetchClassSubjects] selectedClass: ${selectedClass}, mapping exists: ${!!classNameToIdMap[selectedClass]}`);
      return;
    }

    try {
      setIsLoadingSubjects(true);
      const token = localStorage.getItem('accessToken');
      const classId = classNameToIdMap[selectedClass];
      console.log(`[fetchClassSubjects] Fetching subjects for classId: ${classId}`);

      const response = await fetch(
        `/api/wali-kelas/classes/${classId}/subjects`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const subjects = data.data || [];
        console.log(`[fetchClassSubjects] Fetched ${subjects.length} subjects`);
        setClassSubjects(subjects.sort((a: any, b: any) => a.name.localeCompare(b.name)));
      } else {
        console.error(`[fetchClassSubjects] Error: ${response.status}`);
      }
      setIsLoadingSubjects(false);
    } catch (err) {
      console.error('Error fetching subjects:', err);
      setIsLoadingSubjects(false);
    }
  }

  async function fetchGrades() {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');

      // Get current user's classes (they are wali kelas)
      const response = await fetch('/api/wali-kelas/classes', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        setError('Gagal memuat data kelas');
        setIsLoading(false);
        return;
      }

      const classData = await response.json();
      const classIds = classData.data.map((c: any) => c.id);
      const classNameMap: { [key: string]: string } = {};
      classData.data.forEach((c: any) => {
        classNameMap[c.id] = c.name || 'N/A';
      });

      // Fetch approval data from NilaiApprove
      const approvalSet = new Set<string>();
      for (const classId of classIds) {
        try {
          const approvalResponse = await fetch(
            `/api/wali-kelas/nilai-approve?classId=${classId}&limit=1000`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (approvalResponse.ok) {
            const approvalData = await approvalResponse.json();
            const approvals = approvalData.data?.data || [];
            approvals.forEach((approval: any) => {
              // Create a key to identify approved grades: studentId-subjectId-assessmentType
              const key = `${approval.studentId}-${approval.subjectId}`;
              approvalSet.add(key);
            });
          }
        } catch (err) {
          console.log('Failed to fetch approval data for class:', classId);
        }
      }

      setApprovedGrades(approvalSet);

      // Fetch grades for all classes
      const gradesList: Grade[] = [];

      for (const classId of classIds) {
        const gradesResponse = await fetch(
          `/api/teacher/grades?classId=${classId}&limit=1000`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (gradesResponse.ok) {
          const gradesData = await gradesResponse.json();
          const mappedGrades = (gradesData.data || []).map((grade: any) => {
            const key = `${grade.studentId}-${grade.subjectId}`;
            return {
              id: grade.id,
              studentName: grade.studentName || 'N/A',
              studentNo: grade.studentNo || 'N/A',
              studentNourut: grade.studentNourut,
              className: classNameMap[classId] || 'N/A',
              competencyName: grade.competencyName || 'N/A',
              subjectName: grade.subjectName || 'N/A',
              score: String(grade.score || 0),
              assessmentType: grade.assessmentType || 'UTS_1',
              teacherName: grade.teacherName || 'N/A',
              isApproved: approvalSet.has(key),
            };
          });
          gradesList.push(...mappedGrades);
        }
      }

      console.log(`[fetchGrades] Total grades fetched: ${gradesList.length}`);
      setGrades(gradesList);
      // Create reverse mapping: className -> classId
      const reverseMap: { [key: string]: string } = {};
      Object.entries(classNameMap).forEach(([classId, className]) => {
        reverseMap[className] = classId;
      });
      console.log(`[fetchGrades] Class mapping: ${JSON.stringify(reverseMap)}`);
      setClassNameToIdMap(reverseMap);
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching grades:', err);
      setError('Gagal memuat data penilaian');
      setIsLoading(false);
    }
  }

  const translateAssessmentType = (type: string) => {
    const translations: { [key: string]: string } = {
      UTS_1: 'Ujian Tengah Semester 1 (UTS 1)',
      UAS_1: 'Ujian Akhir Semester 1 (UAS 1)',
      UTS_2: 'Ujian Tengah Semester 2 (UTS 2)',
      UAS_2: 'Ujian Akhir Semester 2 (UAS 2)',
      FINAL_EXAM_1: 'Ujian Akhir Siswa Akhir Gel 1',
      FINAL_EXAM_2: 'Ujian Akhir Siswa Gel 2',
    };
    return translations[type] || type;
  };

  // Convert detailed grades to pivot summary - include all students and subjects
  const createSummary = () => {
    const summaryMap: { [key: string]: GradesSummary } = {};

    // Determine which students to show
    const studentsToShow = selectedStudent 
      ? classStudents.filter((s) => s.no === selectedStudent)
      : classStudents;

    // Determine which subjects to show
    const subjectsToShow = selectedSubject
      ? classSubjects.filter((s) => s.name === selectedSubject)
      : classSubjects;

    // First, initialize all class students even if they have no grades
    studentsToShow.forEach((student) => {
      summaryMap[student.no] = {
        studentName: student.name,
        studentNo: student.no,
        studentNourut: student.nourut,
        className: selectedClass,
        subject: '', // Will combine all subjects
      };

      // Initialize columns based on filter
      subjectsToShow.forEach((subject) => {
        // If filtered by assessment type, only show that type; otherwise show all available types
        const typesToShow = selectedAssessmentType 
          ? [selectedAssessmentType]
          : ['UTS_1', 'UAS_1', 'UTS_2', 'UAS_2', 'FINAL_EXAM_1', 'FINAL_EXAM_2'];
        
        typesToShow.forEach((type) => {
          const columnKey = `${subject.name} - ${getAssessmentTypeLabel(type)}`;
          summaryMap[student.no][columnKey] = '—'; // Em dash as default
        });
      });
    });

    // Then add grades from filteredGrades
    filteredGrades.forEach((grade) => {
      const key = grade.studentNo;
      
      if (!summaryMap[key]) {
        summaryMap[key] = {
          studentName: grade.studentName,
          studentNo: grade.studentNo,
          studentNourut: grade.studentNourut,
          className: grade.className,
          subject: '', // Will combine all subjects
        };

        // Initialize columns for new student
        subjectsToShow.forEach((subject) => {
          const typesToShow = selectedAssessmentType 
            ? [selectedAssessmentType]
            : ['UTS_1', 'UAS_1', 'UTS_2', 'UAS_2', 'FINAL_EXAM_1', 'FINAL_EXAM_2'];
          
          typesToShow.forEach((type) => {
            const columnKey = `${subject.name} - ${getAssessmentTypeLabel(type)}`;
            summaryMap[key][columnKey] = '—';
          });
        });
      }

      // Update with actual grade value
      const columnKey = `${grade.subjectName} - ${translateAssessmentType(grade.assessmentType)}`;
      summaryMap[key][columnKey] = grade.score;
    });

    const result = Object.values(summaryMap).sort((a, b) => {
      // Sort by nomor urut first, null values at the end
      if (a.studentNourut && b.studentNourut) {
        return a.studentNourut - b.studentNourut;
      }
      if (a.studentNourut) return -1;
      if (b.studentNourut) return 1;
      return a.studentNo.localeCompare(b.studentNo);
    });

    console.log(`[createSummary] studentsToShow: ${studentsToShow.length}, subjectsToShow: ${subjectsToShow.length}, filteredGrades: ${filteredGrades.length}, selectedStudent: ${selectedStudent}, selectedSubject: ${selectedSubject}, selectedAssessmentType: ${selectedAssessmentType}`);
    return result;
  };

  const getAssessmentTypeLabel = (type: string): string => {
    const translations: { [key: string]: string } = {
      UTS_1: 'Ujian Tengah Semester 1 (UTS 1)',
      UAS_1: 'Ujian Akhir Semester 1 (UAS 1)',
      UTS_2: 'Ujian Tengah Semester 2 (UTS 2)',
      UAS_2: 'Ujian Akhir Semester 2 (UAS 2)',
      FINAL_EXAM_1: 'Ujian Akhir Siswa Akhir Gel 1',
      FINAL_EXAM_2: 'Ujian Akhir Siswa Gel 2',
    };
    return translations[type] || type;
  };

  // Get all unique column names (assessment types)
  const getAllColumns = (): string[] => {
    const allKeys = new Set<string>();
    gradesSummary.forEach((s) => {
      Object.keys(s).forEach((k) => {
        if (!['studentName', 'studentNo', 'studentNourut', 'className', 'subject', 'average'].includes(k)) {
          allKeys.add(k);
        }
      });
    });
    return Array.from(allKeys).sort();
  };

  // Calculate average for each student
  const getStudentAverage = (row: GradesSummary): number => {
    const columns = getAllColumns();
    const values = columns
      .map((col) => {
        const val = row[col];
        return typeof val === 'string' ? parseFloat(val) : val;
      })
      .filter((val): val is number => typeof val === 'number' && !isNaN(val));
    
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  // Calculate sum of all grades for each student
  const getStudentGradeSum = (row: GradesSummary): number => {
    const columns = getAllColumns();
    const sum = columns.reduce((total, col) => {
      const val = row[col];
      const num = typeof val === 'string' ? parseFloat(val) : val;
      if (typeof num === 'number' && !isNaN(num)) {
        return total + num;
      }
      return total;
    }, 0);
    return sum;
  };

  // Calculate average for each column (subject)
  const getColumnAverage = (columnKey: string): number => {
    const values = gradesSummary
      .map((row) => {
        const val = row[columnKey];
        return typeof val === 'string' ? parseFloat(val) : val;
      })
      .filter((val): val is number => typeof val === 'number' && !isNaN(val));
    
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Memuat data penilaian...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-emerald-600 hover:text-emerald-700"
          >
            ← Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Data Penilaian</h1>
          <p className="text-gray-600 mt-2">
            Total: {filteredGrades.length} data penilaian
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsApprovalModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors font-medium"
          >
            <CheckCircle2 size={20} />
            Setujui Penilaian
          </button>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
            Kembali
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} className="text-emerald-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filter Data</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Kelas
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-gray-900 bg-white"
            >
              <option value="">-- Semua Kelas --</option>
              {classes.map((className) => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Mata Pelajaran
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-gray-900 bg-white"
            >
              <option value="">-- Semua Mata Pelajaran --</option>
              {subjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Siswa
            </label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-gray-900 bg-white"
            >
              <option value="">-- Semua Siswa --</option>
              {students.map((student) => (
                <option key={student.no} value={student.no}>
                  {student.name} ({student.no})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Jenis Penilaian
            </label>
            <select
              value={selectedAssessmentType}
              onChange={(e) => setSelectedAssessmentType(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-gray-900 bg-white"
            >
              <option value="">-- Semua Jenis Penilaian --</option>
              {assessmentTypes.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      {filteredGrades.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-emerald-600">
            <p className="text-gray-600 text-sm">Total Data</p>
            <p className="text-2xl font-bold text-gray-900">{filteredGrades.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-600">
            <p className="text-gray-600 text-sm">Mata Pelajaran</p>
            <p className="text-2xl font-bold text-gray-900">
              {Array.from(new Set(filteredGrades.map((g) => g.subjectName))).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-purple-600">
            <p className="text-gray-600 text-sm">Siswa</p>
            <p className="text-2xl font-bold text-gray-900">
              {Array.from(new Set(filteredGrades.map((g) => g.studentNo))).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-orange-600">
            <p className="text-gray-600 text-sm">Jenis Penilaian</p>
            <p className="text-2xl font-bold text-gray-900">
              {Array.from(new Set(filteredGrades.map((g) => g.assessmentType))).length}
            </p>
          </div>
        </div>
      )}

      {/* Grades Table */}
      {selectedClass && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gray-100 px-6 py-3 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">
              Data Penilaian Kelas {selectedClass}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Total Siswa: {gradesSummary.length} | Data Nilai: {filteredGrades.length}
            </p>
          </div>

          {gradesSummary.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Tidak ada siswa di kelas ini
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="sticky left-0 z-10 px-4 py-3 text-center font-semibold text-gray-700 text-sm bg-gray-50">NO</th>
                    <th className="sticky left-16 z-10 px-4 py-3 text-left font-semibold text-gray-700 text-sm bg-gray-50">STAMBUK</th>
                    <th className="sticky left-32 z-10 px-4 py-3 text-left font-semibold text-gray-700 text-sm bg-gray-50">NAMA</th>
                    <th className="sticky left-56 z-10 px-4 py-3 text-left font-semibold text-gray-700 text-sm bg-gray-50">KELAS</th>
                    <th className="sticky left-80 z-10 px-4 py-3 text-center font-semibold text-gray-700 text-sm bg-gray-50">STATUS</th>
                    {/* Dynamic subject + assessment type columns */}
                    {Array.from(
                      new Set(
                        gradesSummary.flatMap((s) =>
                          Object.keys(s).filter(
                            (k) => !['studentName', 'studentNo', 'studentNourut', 'className', 'subject'].includes(k)
                          )
                        )
                      )
                    )
                      .sort()
                      .map((type) => (
                        <th key={type} className="px-4 py-3 text-center font-semibold text-gray-700 text-sm">
                          {type}
                        </th>
                      ))}
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 text-sm bg-purple-50">JUMLAH NILAI</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 text-sm bg-blue-50">RATA-RATA SISWA</th>
                  </tr>
                </thead>
                <tbody>
                  {gradesSummary.map((row, idx) => {
                    // Check if all grades for this student are approved
                    const studentGrades = filteredGrades.filter((g) => g.studentNo === row.studentNo);
                    const allApproved = studentGrades.length > 0 && studentGrades.every((g) => g.isApproved);
                    
                    return (
                      <tr
                        key={row.studentNo}
                        className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <td className="sticky left-0 z-10 px-4 py-3 text-center font-medium text-gray-900 text-sm bg-white hover:bg-gray-50">{row.studentNourut || '-'}</td>
                        <td className="sticky left-16 z-10 px-4 py-3 text-gray-900 font-medium text-sm bg-white hover:bg-gray-50">
                          <div className="flex items-center gap-2">
                            <span>{row.studentNo}</span>
                            {row.studentNourut && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                                #{row.studentNourut}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="sticky left-32 z-10 px-4 py-3 text-gray-900 text-sm bg-white hover:bg-gray-50">{row.studentName}</td>
                        <td className="sticky left-56 z-10 px-4 py-3 text-gray-600 text-sm bg-white hover:bg-gray-50">{row.className}</td>
                        <td className="sticky left-80 z-10 px-4 py-3 text-center bg-white hover:bg-gray-50">
                          {studentGrades.length === 0 ? (
                            <span className="text-xs font-semibold text-gray-500">Belum ada nilai</span>
                          ) : allApproved ? (
                            <div className="flex items-center justify-center gap-1">
                              <CheckCircle2 size={18} className="text-green-600" />
                              <span className="text-xs font-semibold text-green-600">Disetujui</span>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-amber-600">Menunggu</span>
                          )}
                        </td>
                    {/* Dynamic score columns */}
                    {Array.from(
                      new Set(
                        gradesSummary.flatMap((s) =>
                          Object.keys(s).filter(
                            (k) => !['studentName', 'studentNo', 'studentNourut', 'className', 'subject'].includes(k)
                          )
                        )
                      )
                    )
                      .sort()
                      .map((type) => (
                        <td
                          key={type}
                          className="px-4 py-3 text-center font-semibold text-emerald-600 text-sm"
                        >
                          {row[type] || '—'}
                        </td>
                      ))}
                    <td className="px-4 py-3 text-center font-semibold text-purple-600 text-sm bg-purple-50">
                      {getStudentGradeSum(row).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-blue-600 text-sm bg-blue-50">
                      {getStudentAverage(row).toFixed(2)}
                    </td>
                    </tr>
                  );
                })}
                {/* Average row grouped by subject */}
                <tr className="bg-amber-50 border-b border-gray-200 font-semibold">
                  <td colSpan={5} className="sticky left-0 z-10 px-4 py-3 text-right text-gray-900 text-sm bg-amber-50">
                    RATA-RATA MATA PELAJARAN:
                  </td>
                  {(() => {
                    // Get all unique columns
                    const allColumns = Array.from(
                      new Set(
                        gradesSummary.flatMap((s) =>
                          Object.keys(s).filter(
                            (k) => !['studentName', 'studentNo', 'studentNourut', 'className', 'subject'].includes(k)
                          )
                        )
                      )
                    ).sort();

                    // Group columns by subject name
                    const subjectGroups: { [key: string]: string[] } = {};
                    allColumns.forEach((col) => {
                      // Extract subject name (everything before the ' - ')
                      const subjectName = col.substring(0, col.lastIndexOf(' - '));
                      if (!subjectGroups[subjectName]) {
                        subjectGroups[subjectName] = [];
                      }
                      subjectGroups[subjectName].push(col);
                    });

                    // Get sorted subject names
                    const subjects = Object.keys(subjectGroups).sort();

                    // For each subject, calculate average across all its assessment types
                    return subjects.map((subject) => {
                      const subjectColumns = subjectGroups[subject];
                      const values = subjectColumns
                        .flatMap((col) =>
                          gradesSummary.map((row) => {
                            const val = row[col];
                            return typeof val === 'string' ? parseFloat(val) : val;
                          })
                        )
                        .filter((val): val is number => typeof val === 'number' && !isNaN(val));

                      const subjectAverage = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

                      return (
                        <td
                          key={`avg-${subject}`}
                          className="px-4 py-3 text-center font-semibold text-amber-700 text-sm"
                          title={subject}
                        >
                          {subjectAverage.toFixed(2)}
                        </td>
                      );
                    });
                  })()}
                  <td className="px-4 py-3 text-center font-semibold text-amber-700 text-sm bg-amber-100">
                    {(() => {
                      const allColumns = Array.from(
                        new Set(
                          gradesSummary.flatMap((s) =>
                            Object.keys(s).filter(
                              (k) => !['studentName', 'studentNo', 'studentNourut', 'className', 'subject'].includes(k)
                            )
                          )
                        )
                      );
                      const columnAverages = allColumns.map((col) => getColumnAverage(col));
                      const overallAverage = columnAverages.reduce((a, b) => a + b, 0) / columnAverages.length;
                      return overallAverage.toFixed(2);
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>
              </div>

              {/* Mobile Card View */}
              <div className="block md:hidden space-y-4 p-4">
                {gradesSummary.map((row, idx) => {
                  const studentGrades = filteredGrades.filter((g) => g.studentNo === row.studentNo);
                  const allApproved = studentGrades.length > 0 && studentGrades.every((g) => g.isApproved);
                  
                  return (
                    <div key={row.studentNo} className="bg-white rounded-lg shadow-md p-4 border-l-4 border-emerald-600">
                      {/* Student Header */}
                      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-gray-500">Urutan: #{row.studentNourut || '-'}</span>
                            {row.studentNourut && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                                Nomor Urut: {row.studentNourut}
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-gray-900">{row.studentName}</h3>
                          <p className="text-xs text-gray-600">STAMBUK: {row.studentNo}</p>
                          <p className="text-xs text-gray-600">Kelas: {row.className}</p>
                        </div>
                        <div className="text-right">
                          {studentGrades.length === 0 ? (
                            <span className="text-xs font-semibold text-gray-500">Belum ada nilai</span>
                          ) : allApproved ? (
                            <div className="flex items-center justify-end gap-1">
                              <CheckCircle2 size={16} className="text-green-600" />
                              <span className="text-xs font-semibold text-green-600">Disetujui</span>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-amber-600">Menunggu</span>
                          )}
                        </div>
                      </div>

                      {/* Grades Grid */}
                      <div className="grid grid-cols-2 gap-2">
                        {Array.from(
                          new Set(
                            gradesSummary.flatMap((s) =>
                              Object.keys(s).filter(
                                (k) => !['studentName', 'studentNo', 'studentNourut', 'className', 'subject'].includes(k)
                              )
                            )
                          )
                        )
                          .sort()
                          .map((key) => (
                            <div key={key} className="bg-gray-50 rounded p-2">
                              <p className="text-xs text-gray-600 truncate">{key}</p>
                              <p className="text-sm font-semibold text-emerald-600">{row[key] || '—'}</p>
                            </div>
                          ))}
                      </div>

                      {/* Jumlah Nilai dan Rata-rata */}
                      <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-gray-700">Jumlah Nilai</span>
                          <span className="text-lg font-bold text-purple-600">{getStudentGradeSum(row).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-gray-700">Rata-rata</span>
                          <span className="text-lg font-bold text-blue-600">{getStudentAverage(row).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Approval Modal */}
      <ApprovalModal
        isOpen={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        onSuccess={() => fetchGrades()}
        selectedClass={selectedClass}
      />
    </div>
  );
}
