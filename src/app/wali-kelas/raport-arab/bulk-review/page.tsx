'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Download, Eye } from 'lucide-react';

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

function BulkReviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classIdParam = searchParams.get('classId');
  const assessmentType = searchParams.get('assessmentType');
  
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [allStudents, setAllStudents] = useState<(Student & { classId: string; className: string })[]>([]);

  const assessmentTypeLabels: Record<string, string> = {
    'UTS_1': 'UTS Semester 1',
    'UAS_1': 'UAS Semester 1',
    'UTS_2': 'UTS Semester 2',
    'UAS_2': 'UAS Semester 2',
    'FINAL_EXAM_1': 'Ujian Akhir Gel 1',
    'FINAL_EXAM_2': 'Ujian Akhir Gel 2',
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setError('');
      const token = localStorage.getItem('accessToken');

      if (!token || token.trim() === '') {
        setError('Sesi Anda telah berakhir. Silakan login kembali');
        setTimeout(() => router.push('/login'), 1500);
        return;
      }

      const response = await fetch('/api/admin/classes?limit=100', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

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
          data.data.map(async (cls: any) => {
            try {
              const studentsResponse = await fetch(
                `/api/admin/classes/${cls.id}/students?limit=100`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              let students: Student[] = [];
              if (studentsResponse.ok) {
                const studentsData = await studentsResponse.json();
                if (studentsData.success && Array.isArray(studentsData.data)) {
                  students = studentsData.data.map((s: any) => ({
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
            } catch (err) {
              console.warn(`Failed to fetch students for class ${cls.id}`);
              return {
                ...cls,
                students: [],
              };
            }
          })
        );

        setClasses(classesWithStudents);

        // Flatten all students with class info
        const students = classesWithStudents.flatMap((cls) =>
          cls.students.map((student: any) => ({
            ...student,
            classId: cls.id,
            className: cls.name,
          }))
        );
        setAllStudents(students);
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching classes:', err);
      setError('Terjadi kesalahan saat memuat data kelas');
      setIsLoading(false);
    }
  };

  const handleViewRaport = (classId: string, studentId: string) => {
    const params = new URLSearchParams({
      classId,
      studentId,
    });
    if (assessmentType) {
      params.append('assessmentType', assessmentType);
    }
    router.push(`/wali-kelas/raport-arab/detail?${params.toString()}`);
  };

  // Filter students based on classId if provided
  const filteredStudents = classIdParam 
    ? allStudents.filter(s => s.classId === classIdParam)
    : allStudents;

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
            <h1 className="text-3xl font-bold text-emerald-900">Review Keseluruhan Raport</h1>
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
            onClick={() => {}}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors shadow-md"
          >
            <Eye size={20} />
            Review Keseluruhan
          </button>
          <button
            onClick={() => {
              const params = new URLSearchParams();
              if (classIdParam) params.append('classId', classIdParam);
              if (assessmentType) params.append('assessmentType', assessmentType);
              router.push(`/wali-kelas/raport-arab/bulk-download?${params.toString()}`);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-white text-emerald-600 border-2 border-emerald-600 rounded-lg font-semibold hover:bg-emerald-50 transition-colors"
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

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {filteredStudents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-emerald-600 text-white">
                    <th className="px-6 py-4 text-left font-semibold">Nama Siswa</th>
                    <th className="px-6 py-4 text-left font-semibold">Nomor Induk</th>
                    <th className="px-6 py-4 text-left font-semibold">Kelas</th>
                    <th className="px-6 py-4 text-center font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredStudents.map((student, index) => (
                    <tr
                      key={`${student.classId}-${student.id}`}
                      className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">{student.name}</td>
                      <td className="px-6 py-4 text-gray-600">{student.studentNo}</td>
                      <td className="px-6 py-4 text-gray-600">{student.className}</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleViewRaport(student.classId, student.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                        >
                          <Eye size={18} />
                          Lihat
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <p className="text-lg">Tidak ada data siswa</p>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-gray-600 text-sm font-semibold">Total Kelas</div>
            <div className="text-3xl font-bold text-emerald-600 mt-2">{classes.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-gray-600 text-sm font-semibold">Total Siswa</div>
            <div className="text-3xl font-bold text-emerald-600 mt-2">{allStudents.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-gray-600 text-sm font-semibold">Rata-rata Siswa/Kelas</div>
            <div className="text-3xl font-bold text-emerald-600 mt-2">
              {classes.length > 0 ? (allStudents.length / classes.length).toFixed(1) : 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BulkReviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 flex items-center justify-center">
        <p className="text-gray-600">Memuat data...</p>
      </div>
    }>
      <BulkReviewPageContent />
    </Suspense>
  );
}
