'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Filter, Download } from 'lucide-react';

interface Grade {
  id: string;
  studentName: string;
  studentNo: string;
  className: string;
  competencyName: string;
  subjectName: string;
  score: string;
  assessmentType: string;
  teacherName: string;
}

interface GradesSummary {
  studentName: string;
  studentNo: string;
  className: string;
  subject: string;
  [key: string]: string | number; // For dynamic assessment type columns
}

export default function PenilaianPage() {
  const router = useRouter();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [filteredGrades, setFilteredGrades] = useState<Grade[]>([]);
  const [gradesSummary, setGradesSummary] = useState<GradesSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [selectedAssessmentType, setSelectedAssessmentType] = useState<string>('');

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
    { code: 'DAILY', label: 'Harian' },
    { code: 'QUIZ', label: 'Kuis' },
    { code: 'TASK', label: 'Tugas' },
    { code: 'PROJECT', label: 'Proyek' },
    { code: 'MIDTERM', label: 'UTS' },
    { code: 'FINAL', label: 'UAS' },
  ].filter((type) => grades.some((g) => g.assessmentType === type.code));

  useEffect(() => {
    fetchGrades();
  }, []);

  useEffect(() => {
    let filtered = [...grades];

    if (selectedClass) {
      filtered = filtered.filter((g) => g.className === selectedClass);
    }

    if (selectedSubject) {
      filtered = filtered.filter((g) => g.subjectName === selectedSubject);
    }

    if (selectedStudent) {
      filtered = filtered.filter((g) => g.studentNo === selectedStudent);
    }

    if (selectedAssessmentType) {
      filtered = filtered.filter((g) => g.assessmentType === selectedAssessmentType);
    }

    setFilteredGrades(filtered);
  }, [grades, selectedClass, selectedSubject, selectedStudent, selectedAssessmentType]);

  useEffect(() => {
    setGradesSummary(createSummary());
  }, [filteredGrades]);

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
          const mappedGrades = (gradesData.data || []).map((grade: any) => ({
            id: grade.id,
            studentName: grade.studentName || 'N/A',
            studentNo: grade.studentNo || 'N/A',
            className: classNameMap[classId] || 'N/A',
            competencyName: grade.competencyName || 'N/A',
            subjectName: grade.subjectName || 'N/A',
            score: String(grade.score || 0),
            assessmentType: grade.assessmentType || 'DAILY',
            teacherName: grade.teacherName || 'N/A',
          }));
          gradesList.push(...mappedGrades);
        }
      }

      setGrades(gradesList);
      setFilteredGrades(gradesList);
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching grades:', err);
      setError('Gagal memuat data penilaian');
      setIsLoading(false);
    }
  }

  const translateAssessmentType = (type: string) => {
    const translations: { [key: string]: string } = {
      DAILY: 'Harian',
      QUIZ: 'Kuis',
      MIDTERM: 'UTS',
      FINAL: 'UAS',
      TASK: 'Tugas',
      PROJECT: 'Proyek',
    };
    return translations[type] || type;
  };

  // Convert detailed grades to pivot summary
  const createSummary = () => {
    const summaryMap: { [key: string]: GradesSummary } = {};

    filteredGrades.forEach((grade) => {
      const key = grade.studentNo;
      
      if (!summaryMap[key]) {
        summaryMap[key] = {
          studentName: grade.studentName,
          studentNo: grade.studentNo,
          className: grade.className,
          subject: '', // Will combine all subjects
        };
      }

      // Create column key for subject + assessment type
      const columnKey = `${grade.subjectName} - ${translateAssessmentType(grade.assessmentType)}`;
      summaryMap[key][columnKey] = grade.score;
    });

    return Object.values(summaryMap).sort((a, b) => {
      return a.studentNo.localeCompare(b.studentNo);
    });
  };

  // Get all unique column names (assessment types)
  const getAllColumns = (): string[] => {
    const allKeys = new Set<string>();
    gradesSummary.forEach((s) => {
      Object.keys(s).forEach((k) => {
        if (!['studentName', 'studentNo', 'className', 'subject', 'average'].includes(k)) {
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
      .filter((val) => !isNaN(val));
    
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  // Calculate average for each column (subject)
  const getColumnAverage = (columnKey: string): number => {
    const values = gradesSummary
      .map((row) => {
        const val = row[columnKey];
        return typeof val === 'string' ? parseFloat(val) : val;
      })
      .filter((val) => !isNaN(val));
    
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
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
          Kembali
        </button>
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
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-gray-100 px-6 py-3 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">
            Data Penilaian
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Total: {filteredGrades.length} data
          </p>
        </div>

        {filteredGrades.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Tidak ada data penilaian
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 text-sm">NO</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-sm">STAMBUK</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-sm">NAMA</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-sm">KELAS</th>
                  {/* Dynamic subject + assessment type columns */}
                  {Array.from(
                    new Set(
                      gradesSummary.flatMap((s) =>
                        Object.keys(s).filter(
                          (k) => !['studentName', 'studentNo', 'className', 'subject'].includes(k)
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
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 text-sm bg-blue-50">RATA-RATA SISWA</th>
                </tr>
              </thead>
              <tbody>
                {gradesSummary.map((row, idx) => (
                  <tr
                    key={row.studentNo}
                    className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-center font-medium text-gray-900 text-sm">{idx + 1}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium text-sm">{row.studentNo}</td>
                    <td className="px-4 py-3 text-gray-900 text-sm">{row.studentName}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{row.className}</td>
                    {/* Dynamic score columns */}
                    {Array.from(
                      new Set(
                        gradesSummary.flatMap((s) =>
                          Object.keys(s).filter(
                            (k) => !['studentName', 'studentNo', 'className', 'subject'].includes(k)
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
                    <td className="px-4 py-3 text-center font-semibold text-blue-600 text-sm bg-blue-50">
                      {getStudentAverage(row).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {/* Average row for each column */}
                <tr className="bg-amber-50 border-b border-gray-200 font-semibold">
                  <td colSpan={4} className="px-4 py-3 text-right text-gray-900 text-sm">
                    RATA-RATA MATA PELAJARAN:
                  </td>
                  {Array.from(
                    new Set(
                      gradesSummary.flatMap((s) =>
                        Object.keys(s).filter(
                          (k) => !['studentName', 'studentNo', 'className', 'subject'].includes(k)
                        )
                      )
                    )
                  )
                    .sort()
                    .map((type) => (
                      <td
                        key={`avg-${type}`}
                        className="px-4 py-3 text-center font-semibold text-amber-700 text-sm"
                      >
                        {getColumnAverage(type).toFixed(2)}
                      </td>
                    ))}
                  <td className="px-4 py-3 text-center font-semibold text-amber-700 text-sm bg-amber-100">
                    {(() => {
                      const allColumns = Array.from(
                        new Set(
                          gradesSummary.flatMap((s) =>
                            Object.keys(s).filter(
                              (k) => !['studentName', 'studentNo', 'className', 'subject'].includes(k)
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
        )}
      </div>
    </div>
  );
}
