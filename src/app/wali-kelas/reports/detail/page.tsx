'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  studentNo: string;
  birthDate?: string;
}

interface Grade {
  id: string;
  studentName?: string;
  competencyName: string;
  subjectName: string;
  score: string;
  assessmentType: string;
}

interface Attendance {
  status: 'HADIR' | 'SAKIT' | 'IZIN' | 'ALFA';
  count: number;
}

interface ReportData {
  student: Student;
  grades: Grade[];
  attendance: Attendance[];
  semester: string;
  schoolYear: string;
}

export default function ReportDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = searchParams.get('classId');
  const studentId = searchParams.get('studentId');

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (classId && studentId) {
      fetchReportData();
    }
  }, [classId, studentId]);

  async function fetchReportData() {
    try {
      // Generate dummy data for now
      const dummyData: ReportData = {
        student: {
          id: studentId || 'STU001',
          name: 'Aldi Pratama',
          studentNo: '001/XII.IPA.1/2024',
          birthDate: '2006-01-15',
        },
        grades: [
          {
            id: '1',
            competencyName: 'Memahami operasi aljabar pada polinomial',
            subjectName: 'Matematika',
            score: '85',
            assessmentType: 'MIDTERM',
          },
          {
            id: '2',
            competencyName: 'Menerapkan operasi aljabar pada polinomial',
            subjectName: 'Matematika',
            score: '82',
            assessmentType: 'FINAL',
          },
          {
            id: '3',
            competencyName: 'Memahami struktur atom dan ikatan kimia',
            subjectName: 'Ilmu Pengetahuan Alam',
            score: '88',
            assessmentType: 'MIDTERM',
          },
          {
            id: '4',
            competencyName: 'Melakukan eksperimen ikatan kimia',
            subjectName: 'Ilmu Pengetahuan Alam',
            score: '90',
            assessmentType: 'FINAL',
          },
        ],
        attendance: [
          { status: 'HADIR', count: 18 },
          { status: 'SAKIT', count: 1 },
          { status: 'IZIN', count: 1 },
          { status: 'ALFA', count: 0 },
        ],
        semester: 'Semester 1',
        schoolYear: '2024/2025',
      };

      setReportData(dummyData);
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching report:', err);
      setError('Gagal memuat data laporan');
      setIsLoading(false);
    }
  }

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Memuat laporan...</p>
        </div>
      </div>
    );
  }

  if (error || !reportData) {
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

  const avgScore = reportData.grades.length > 0
    ? (
        reportData.grades.reduce((sum, g) => sum + parseFloat(g.score), 0) /
        reportData.grades.length
      ).toFixed(2)
    : '0';

  return (
    <>
      {/* Screen View */}
      <div className="block print:hidden mb-6 space-y-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
            Kembali
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Printer size={20} />
            Cetak Raport
          </button>
        </div>
      </div>

      {/* Report Content */}
      <div className="bg-white p-8 print:p-0">
        {/* Header */}
        <div className="text-center border-b-4 border-gray-900 pb-4 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">RAPORT PESERTA DIDIK</h1>
          <p className="text-base text-gray-800 mt-2 font-semibold">
            {reportData.schoolYear} - {reportData.semester}
          </p>
        </div>

        {/* Student Info */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <p className="font-bold text-gray-900 text-base">Nama Siswa</p>
            <p className="text-gray-900 text-base">{reportData.student.name}</p>
          </div>
          <div>
            <p className="font-bold text-gray-900 text-base">Nomor Induk</p>
            <p className="text-gray-900 text-base">{reportData.student.studentNo}</p>
          </div>
          <div>
            <p className="font-bold text-gray-900 text-base">Tempat/Tgl Lahir</p>
            <p className="text-gray-900 text-base">
              -/-{' '}
              {reportData.student.birthDate
                ? new Date(reportData.student.birthDate).toLocaleDateString('id-ID')
                : '-'}
            </p>
          </div>
          <div>
            <p className="font-bold text-gray-900 text-base">Kelas</p>
            <p className="text-gray-900 text-base">XII IPA 1</p>
          </div>
        </div>

        <div className="mb-8 pb-8 border-b-2 border-gray-900">
          {/* Grades Section */}
          <h2 className="text-2xl font-bold mb-4 text-gray-900">A. HASIL BELAJAR</h2>

          {/* Group by Subject */}
          {Array.from(
            new Set(reportData.grades.map((g) => g.subjectName))
          ).map((subject) => (
            <div key={subject} className="mb-6">
              <h3 className="font-bold text-base mb-3 bg-emerald-600 text-white px-3 py-2 rounded">
                {subject}
              </h3>
              <table className="w-full text-base border-collapse">
                <thead>
                  <tr className="bg-emerald-700 border border-gray-900">
                    <th className="border border-gray-900 px-3 py-2 text-left text-white font-bold">
                      Kompetensi
                    </th>
                    <th className="border border-gray-900 px-3 py-2 text-center w-24 text-white font-bold">
                      Nilai
                    </th>
                    <th className="border border-gray-900 px-3 py-2 text-center w-20 text-white font-bold">
                      Jenis
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.grades
                    .filter((g) => g.subjectName === subject)
                    .map((grade) => (
                      <tr key={grade.id} className="border border-gray-900">
                        <td className="border border-gray-900 px-3 py-2 text-gray-900">
                          {grade.competencyName}
                        </td>
                        <td className="border border-gray-900 px-3 py-2 text-center font-bold text-gray-900">
                          {grade.score}
                        </td>
                        <td className="border border-gray-900 px-3 py-2 text-center text-gray-900 font-semibold">
                          {grade.assessmentType === 'MIDTERM'
                            ? 'UTS'
                            : grade.assessmentType === 'FINAL'
                              ? 'UAS'
                              : grade.assessmentType}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}

          {/* Average Score */}
          <div className="mt-4 p-4 bg-emerald-600 rounded border-2 border-gray-900">
            <p className="text-base text-white font-bold">
              Rata-rata Nilai:{' '}
              <span className="text-2xl">{avgScore}</span>
            </p>
          </div>
        </div>

        {/* Attendance Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">B. ABSENSI</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {reportData.attendance.map((att) => (
              <div key={att.status} className="border-2 border-gray-900 rounded-lg p-4 text-center bg-white">
                <p className="text-base text-gray-900 font-bold mb-2 capitalize">
                  {att.status === 'HADIR'
                    ? 'Hadir'
                    : att.status === 'SAKIT'
                      ? 'Sakit'
                      : att.status === 'IZIN'
                        ? 'Izin'
                        : 'Alfa'}
                </p>
                <p className="text-4xl font-bold text-emerald-700">{att.count}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Notes Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">C. CATATAN PERKEMBANGAN</h2>
          <div className="border-2 border-gray-900 rounded-lg p-4 font-serif italic text-gray-900 min-h-24">
            Siswa menunjukkan kemajuan yang baik dalam pembelajaran. Partisipasi aktif dalam kelas
            dan mengerjakan tugas dengan baik. Perlu meningkatkan disiplin dan kehadiran.
          </div>
        </div>

        {/* Signature Section */}
        <div className="mt-12 grid grid-cols-3 gap-8 text-center text-base">
          <div>
            <p className="font-bold text-gray-900 mb-12">Orang Tua/Wali</p>
            <p className="border-t-4 border-gray-900 pt-2 text-gray-900 font-semibold">(...........................)</p>
          </div>
          <div>
            <p className="font-bold text-gray-900 mb-12">Wali Kelas</p>
            <p className="border-t-4 border-gray-900 pt-2 text-gray-900 font-semibold">(...........................)</p>
          </div>
          <div>
            <p className="font-bold text-gray-900 mb-12">Kepala Sekolah</p>
            <p className="border-t-4 border-gray-900 pt-2 text-gray-900 font-semibold">(...........................)</p>
          </div>
        </div>

        {/* Print Date */}
        <div className="mt-8 text-right text-base text-gray-900 font-semibold">
          Dicetak pada: {new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          .no-print {
            display: none;
          }
          @page {
            size: A4;
            margin: 15mm;
          }
          table {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </>
  );
}
