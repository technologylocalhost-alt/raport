'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Download, Eye, Check } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { devError } from '@/lib/dev-log';

interface Student {
  id: string;
  name: string;
  studentNo: string;
  class?: string;
}

interface Class {
  id: string;
  name: string;
  code: string;
  students: Student[];
}

interface StudentWithClass extends Student {
  classId: string;
  className: string;
}

interface ClassApiItem extends Omit<Class, 'students'> {
  students?: Student[];
}

interface StudentApiItem {
  id: string;
  name: string;
  studentNo: string;
}

function BulkDownloadPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classIdParam = searchParams.get('classId');
  const assessmentType = searchParams.get('assessmentType');
  
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [allStudents, setAllStudents] = useState<StudentWithClass[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);

  const assessmentTypeLabels: Record<string, string> = {
    'UTS_1': 'UTS Semester 1',
    'UAS_1': 'UAS Semester 1',
    'UTS_2': 'UTS Semester 2',
    'UAS_2': 'UAS Semester 2',
    'FINAL_EXAM_1': 'Ujian Akhir Gel 1',
    'FINAL_EXAM_2': 'Ujian Akhir Gel 2',
  };

  useEffect(() => {
    const fetchAllData = async () => {
    try {
      setError('');

      const response = await apiFetch('/api/admin/classes?limit=100');

      if (response.status === 401) {
        setError('Sesi Anda telah berakhir. Silakan login kembali');
        setTimeout(() => router.push('/login'), 1500);
        return;
      }

      if (!response.ok) {
        throw new Error('Gagal memuat data kelas');
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        const classesWithStudents = await Promise.all(
          (data.data as ClassApiItem[]).map(async (cls) => {
            try {
              const studentsResponse = await apiFetch(
                `/api/admin/classes/${cls.id}/students?limit=100`
              );

              let students: Student[] = [];
              if (studentsResponse.ok) {
                const studentsData = await studentsResponse.json();
                if (studentsData.success && Array.isArray(studentsData.data)) {
                  students = (studentsData.data as StudentApiItem[]).map((s) => ({
                    id: s.id,
                    name: s.name,
                    studentNo: s.studentNo,
                    class: cls.name,
                  }));
                }
              }

              return {
                ...cls,
                students,
              };
            } catch {
              return {
                ...cls,
                students: [],
              };
            }
          })
        );

        setClasses(classesWithStudents);

        const students = classesWithStudents.flatMap((cls) =>
          cls.students.map((student: Student) => ({
            ...student,
            classId: cls.id,
            className: cls.name,
          }))
        );
        setAllStudents(students);
      }

      setIsLoading(false);
    } catch (error) {
      devError('Error fetching classes:', error);
      setError('Terjadi kesalahan saat memuat data kelas');
      setIsLoading(false);
    }
  };

    void fetchAllData();
  }, [router]);

  const toggleSelectStudent = (key: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedStudents(newSelected);
  };

  const toggleSelectAll = (classId: string) => {
    const classStudents = filteredStudents.filter((s) => s.classId === classId);
    const newSelected = new Set(selectedStudents);

    const allSelected = classStudents.every((s) => newSelected.has(`${s.classId}-${s.id}`));

    classStudents.forEach((student) => {
      const key = `${student.classId}-${student.id}`;
      if (allSelected) {
        newSelected.delete(key);
      } else {
        newSelected.add(key);
      }
    });

    setSelectedStudents(newSelected);
  };

  // Filter students based on classId if provided
  const filteredStudents = classIdParam 
    ? allStudents.filter(s => s.classId === classIdParam)
    : allStudents;

  // Filter classes to show only the selected class if classIdParam is set
  const filteredClasses = classIdParam
    ? classes.filter(c => c.id === classIdParam)
    : classes;

  const handleDownloadSelected = async () => {
    if (selectedStudents.size === 0) {
      alert('Silakan pilih minimal satu siswa');
      return;
    }

    setIsDownloading(true);

    try {
      for (const key of selectedStudents) {
        const [classId, studentId] = key.split('-');
        const student = allStudents.find((s) => s.id === studentId && s.classId === classId);

        if (!student) continue;

        // Fetch grades and other data for student
        const gradesResponse = await apiFetch(
          `/api/teacher/grades?studentId=${studentId}&classId=${classId}&limit=100`
        );

        const gradesData = await gradesResponse.json();
        const grades = gradesData.data || [];

        // Fetch more data...
        await apiFetch(`/api/admin/classes/${classId}`);

        // Download PDF
        const pdfResponse = await apiFetch('/api/wali-kelas/generate-pdf-puppeteer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            student: {
              id: student.id,
              name: student.name,
              studentNo: student.studentNo,
              class: student.className,
            },
            subjectScores: grades,
            semester: 'Semester 2',
            schoolYear: '2024/2025',
          }),
        });

        if (pdfResponse.ok) {
          const { pdf, fileName } = await pdfResponse.json();
          const link = document.createElement('a');
          link.href = pdf;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Add delay to avoid overwhelming server
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      alert(`${selectedStudents.size} raport berhasil diunduh`);
      setSelectedStudents(new Set());
    } catch (error) {
      devError('Error downloading PDFs:', error);
      alert('Terjadi kesalahan saat mengunduh raport');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 flex items-center justify-center">
        <p className="text-gray-600">Memuat data raport...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push('/wali-kelas/raport-arab')}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-md"
          >
            <ArrowLeft size={20} />
            Kembali
          </button>
          <div>
            <h1 className="text-3xl font-bold text-emerald-900">Download Semua Raport</h1>
            {(classIdParam || assessmentType) && (
              <p className="text-sm text-gray-600 mt-1">
                {classIdParam && (
                  <span>Kelas: {classes.find(c => c.id === classIdParam)?.name || 'N/A'}</span>
                )}
                {classIdParam && assessmentType && <span> • </span>}
                {assessmentType && (
                  <span>Jenis: {assessmentTypeLabels[assessmentType] || assessmentType}</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Menu Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => router.push('/wali-kelas/raport-arab')}
            className="flex items-center gap-2 px-6 py-3 bg-white text-emerald-600 border-2 border-emerald-600 rounded-lg font-semibold hover:bg-emerald-50 transition-colors"
          >
            Review Individual
          </button>
          <button
            onClick={() => {
              const params = new URLSearchParams();
              if (classIdParam) params.append('classId', classIdParam);
              if (assessmentType) params.append('assessmentType', assessmentType);
              router.push(`/wali-kelas/raport-arab/bulk-review?${params.toString()}`);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-white text-emerald-600 border-2 border-emerald-600 rounded-lg font-semibold hover:bg-emerald-50 transition-colors"
          >
            <Eye size={20} />
            Review Keseluruhan
          </button>
          <button
            onClick={() => {}}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors shadow-md"
          >
            <Download size={20} />
            Download Semua
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Classes and Students */}
        <div className="space-y-6">
          {filteredClasses.map((cls) => (
            <div key={cls.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">{cls.name}</h2>
                <button
                  onClick={() => toggleSelectAll(cls.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors text-sm font-semibold"
                >
                  <Check size={18} />
                  Pilih Semua
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200">
                      <th className="px-6 py-4 text-left w-12">
                        <input
                          type="checkbox"
                          checked={cls.students.every((s) =>
                            selectedStudents.has(`${cls.id}-${s.id}`)
                          )}
                          onChange={() => toggleSelectAll(cls.id)}
                          className="w-5 h-5 cursor-pointer"
                        />
                      </th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-900">Nama Siswa</th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-900">Nomor Induk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {cls.students.map((student) => {
                      const key = `${cls.id}-${student.id}`;
                      const isSelected = selectedStudents.has(key);

                      return (
                        <tr
                          key={key}
                          className={isSelected ? 'bg-emerald-50' : 'bg-white hover:bg-gray-50'}
                        >
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectStudent(key)}
                              className="w-5 h-5 cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-900">{student.name}</td>
                          <td className="px-6 py-4 text-gray-600">{student.studentNo}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Download Button */}
        <div className="mt-8 flex gap-4 justify-end">
          <div className="text-gray-600 font-semibold">
            {selectedStudents.size} siswa dipilih dari {filteredStudents.length}
          </div>
          <button
            onClick={handleDownloadSelected}
            disabled={selectedStudents.size === 0 || isDownloading}
            className={`flex items-center gap-2 px-8 py-3 rounded-lg font-semibold transition-colors ${
              selectedStudents.size === 0 || isDownloading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            <Download size={20} />
            {isDownloading ? 'Mengunduh...' : 'Unduh Raport Terpilih'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BulkDownloadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 flex items-center justify-center">
        <p className="text-gray-600">Memuat data...</p>
      </div>
    }>
      <BulkDownloadPageContent />
    </Suspense>
  );
}
