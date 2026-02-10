'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  studentNo: string;
  birthDate?: string;
}

interface School {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  principal?: string;
}

interface Grade {
  id: string;
  studentName?: string;
  competencyName: string;
  subjectName: string;
  score: string;
  assessmentType: string;
}

interface ReportData {
  student: Student;
  grades: Grade[];
  attendance: {
    HADIR: number;
    SAKIT: number;
    IZIN: number;
    ALFA: number;
  };
  studentNotes: {
    developmentNotes: string;
    achievedCompetencies: string;
    improvementAreas: string;
  };
  semester: string;
  schoolYear: string;
  school: School;
}

function ReportDetailContent() {
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
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');

      console.log('📋 Fetching report data...');
      console.log('classId:', classId);
      console.log('studentId:', studentId);
      console.log('token exists:', !!token);

      if (!token) {
        setError('Token tidak ditemukan. Silakan login ulang');
        setIsLoading(false);
        return;
      }

      // Fetch class data to get school
      const classResponse = await fetch(`/api/admin/classes/${classId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('✓ Class API response:', classResponse.status);

      if (classResponse.status === 401) {
        setError('Token expired. Silakan login ulang');
        setIsLoading(false);
        return;
      }

      let school: School = {
        id: '',
        name: 'MADRASAH ALIYAH ISLAMIC SCHOOL',
        address: 'Jl. Ahmad Yani No. 123, Jakarta, Indonesia',
        phone: '(021) 555-1234',
        email: 'info@mas.sch.id',
        principal: 'K.H. KULLIYATUL MUALLAIMIN AL ISLAMIYAH, M.A.',
      };

      if (classResponse.ok) {
        const classData = await classResponse.json();
        if (classData.data?.school) {
          school = {
            id: classData.data.school.id,
            name: classData.data.school.name || 'MADRASAH ALIYAH ISLAMIC SCHOOL',
            address: classData.data.school.address || '',
            phone: classData.data.school.phone || '(021) 555-1234',
            email: classData.data.school.email || 'info@mas.sch.id',
            principal: classData.data.school.principal || 'K.H. KULLIYATUL MUALLIMIN ALISLAMIYAH, M.A.',
          };
        }
      }

      // Fetch student data
      const studentResponse = await fetch(`/api/admin/students/${studentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('✓ Student API response:', studentResponse.status);

      if (studentResponse.status === 401) {
        setError('Token expired. Silakan login ulang');
        setIsLoading(false);
        return;
      }

      if (!studentResponse.ok) {
        setError(`Gagal memuat data siswa: ${studentResponse.status}`);
        setIsLoading(false);
        return;
      }

      const studentData = await studentResponse.json();
      const student = {
        id: studentData.data.id,
        name: studentData.data.name,
        studentNo: studentData.data.nisn || '-',
        birthDate: studentData.data.birthDate || '-',
      };

      console.log('✓ Student data loaded:', student.name);

      // Fetch grades for this student
      const gradesResponse = await fetch(
        `/api/teacher/grades?studentId=${studentId}&classId=${classId}&limit=100`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log('✓ Grades API response:', gradesResponse.status);

      let grades: any[] = [];
      if (!gradesResponse.ok) {
        console.warn('⚠️ Grades API response not ok:', gradesResponse.status);
      } else {
        const gradesData = await gradesResponse.json();
        grades = (gradesData.data || []).map((grade: any) => ({
          id: grade.id,
          competencyName: grade.competencyName || 'N/A',
          subjectName: grade.subjectName || 'N/A',
          score: String(grade.score || 0),
          assessmentType: grade.assessmentType || 'DAILY',
        }));
        console.log(`✓ Loaded ${grades.length} grades`);
      }

      // Fetch attendance data
      const attendanceResponse = await fetch(
        `/api/teacher/students/${studentId}/attendance?classId=${classId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      let attendance = {
        HADIR: 0,
        SAKIT: 0,
        IZIN: 0,
        ALFA: 0,
      };

      if (attendanceResponse.ok) {
        const attendanceData = await attendanceResponse.json();
        attendance = attendanceData.data.summary;
        console.log('✓ Attendance data loaded:', attendance);
      } else {
        console.warn('⚠️ Attendance API response not ok:', attendanceResponse.status);
      }

      // Fetch student notes
      const notesResponse = await fetch(
        `/api/teacher/students/${studentId}/notes?classId=${classId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      let studentNotes = {
        developmentNotes: '',
        achievedCompetencies: '',
        improvementAreas: '',
      };

      if (notesResponse.ok) {
        const notesData = await notesResponse.json();
        studentNotes = notesData.data;
        console.log('✓ Student notes loaded');
      } else {
        console.warn('⚠️ Notes API response not ok:', notesResponse.status);
      }

      console.log('✅ All data loaded successfully');

      setReportData({
        student,
        grades,
        attendance,
        studentNotes,
        semester: 'Semester 1',
        schoolYear: '2024/2025',
        school,
      });
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
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        html, body {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          font-family: 'Times New Roman', Times, serif;
          color: black;
          background: white;
          overflow-x: hidden;
        }

        .a4-wrapper {
          background: #f5f5f5;
          padding: 60px 20px 20px 20px;
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          width: 100%;
          margin: 0;
        }

        .a4-page {
          width: 210mm;
          height: 297mm;
          background: white;
          box-shadow: 0 0 10px rgba(0,0,0,0.3);
          padding: 12mm 15mm;
          font-size: 11pt;
          line-height: 1.4;
          font-family: 'Times New Roman', Times, serif;
          position: relative;
          overflow: hidden;
        }

        .toolbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: #f5f5f5;
          padding: 12px 20px;
          border-bottom: 1px solid #ddd;
          display: flex;
          gap: 12px;
          align-items: center;
          z-index: 200;
          width: 100%;
        }

        @media print {
          html, body {
            width: 100%;
            margin: 0;
            padding: 0;
          }

          body > div:first-child > aside {
            display: none !important;
          }

          body > div:first-child {
            width: 100%;
          }

          .toolbar {
            display: none !important;
          }

          .a4-wrapper {
            background: white;
            padding: 0 !important;
            min-height: auto;
            margin: 0;
          }

          .a4-page {
            width: 210mm !important;
            height: 297mm !important;
            padding: 12mm 15mm !important;
            box-shadow: none !important;
            margin: 0 !important;
            page-break-after: always;
            page-break-inside: avoid;
          }

          @page {
            size: A4;
            margin: 0;
            padding: 0;
          }
        }

        .school-header {
          text-align: center;
          margin-bottom: 6pt;
          padding-bottom: 6pt;
          border-bottom: 2pt solid black;
        }

        .school-header h4 {
          font-size: 10.5pt;
          font-weight: bold;
          margin: 1pt 0;
          line-height: 1.2;
        }

        .school-header p {
          font-size: 9pt;
          margin: 1pt 0;
          line-height: 1.2;
        }

        .report-title {
          text-align: center;
          font-size: 12pt;
          font-weight: bold;
          margin: 6pt 0;
          text-decoration: underline;
        }

        .student-info {
          font-size: 10pt;
          margin-bottom: 6pt;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8pt;
          padding-bottom: 6pt;
          border-bottom: 1pt solid black;
          line-height: 1.3;
        }

        .info-row {
          display: flex;
          gap: 8pt;
          margin-bottom: 2pt;
        }

        .info-row label {
          min-width: 85pt;
          font-weight: bold;
        }

        .section-title {
          font-size: 11pt;
          font-weight: bold;
          margin-top: 6pt;
          margin-bottom: 3pt;
          padding-bottom: 2pt;
          border-bottom: 1pt solid black;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 6pt;
          font-size: 9.5pt;
        }

        th {
          background-color: #059669;
          color: white;
          padding: 3pt 4pt;
          text-align: center;
          font-weight: bold;
          border: 1pt solid black;
          font-size: 9.5pt;
          height: 18pt;
        }

        td {
          border: 1pt solid black;
          padding: 3pt 4pt;
          text-align: left;
          font-size: 9.5pt;
          height: 16pt;
        }

        td.center {
          text-align: center;
        }

        td.right {
          text-align: right;
        }

        tr.summary {
          background-color: #f0f0f0;
          font-weight: bold;
        }

        tr.summary td {
          padding: 2pt 4pt;
          height: 14pt;
        }

        .footer {
          position: absolute;
          bottom: 12mm;
          left: 15mm;
          right: 15mm;
          font-size: 9pt;
          display: flex;
          justify-content: flex-end;
        }

        .signature {
          width: 40%;
          text-align: center;
          font-size: 9pt;
          line-height: 1.2;
        }

        .signature p {
          margin: 2pt 0;
        }

        .signature-line {
          margin-top: 20pt;
          border-top: 1pt solid black;
          padding-top: 2pt;
          font-weight: bold;
        }

        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="toolbar">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-300 rounded transition-colors"
        >
          <ArrowLeft size={20} />
          Kembali
        </button>
        <div className="h-6 w-px bg-gray-300"></div>
        <span className="text-gray-600 text-sm">Raport Peserta Didik - A4</span>
        <button
          onClick={handlePrint}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
        >
          <Printer size={20} />
          Cetak
        </button>
      </div>

      <div className="a4-wrapper">
        <div className="a4-page">
          {/* School Header */}
          <div className="school-header">
            <h4>KEMENTERIAN AGAMA REPUBLIC INDONESIA</h4>
            <h4>{reportData.school.name}</h4>
            <p>{reportData.school.address}</p>
            <p>Tlp: {reportData.school.phone} | Email: {reportData.school.email}</p>
          </div>

          {/* Report Title */}
          <div className="report-title">RAPORT PESERTA DIDIK</div>

          {/* Student Info */}
          <div className="student-info">
            <div>
              <div className="info-row">
                <label>Nama</label>
                <span>: {reportData.student.name}</span>
              </div>
              <div className="info-row">
                <label>Tgl. Lahir</label>
                <span>: {reportData.student.birthDate ? new Date(reportData.student.birthDate).toLocaleDateString('id-ID') : '-'}</span>
              </div>
              <div className="info-row">
                <label>No. Induk</label>
                <span>: {reportData.student.studentNo}</span>
              </div>
            </div>
            <div>
              <div className="info-row">
                <label>Kelas</label>
                <span>: 10 A</span>
              </div>
              <div className="info-row">
                <label>Tahun Ajaran</label>
                <span>: {reportData.schoolYear}</span>
              </div>
              <div className="info-row">
                <label>Semester</label>
                <span>: {reportData.semester}</span>
              </div>
            </div>
          </div>

          {/* Grades Section */}
          <div className="section-title">A. HASIL BELAJAR</div>
          {(() => {
            const subjectScores: { [key: string]: number[] } = {};
            reportData.grades.forEach((grade) => {
              if (!subjectScores[grade.subjectName]) {
                subjectScores[grade.subjectName] = [];
              }
              const scoreNum = parseFloat(grade.score);
              if (!isNaN(scoreNum) && scoreNum > 0) {
                subjectScores[grade.subjectName].push(scoreNum);
              }
            });

            const numberToIndonesian = (num: number): string => {
              const ones = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan'];
              const teens = ['Sepuluh', 'Sebelas', 'Dua Belas', 'Tiga Belas', 'Empat Belas', 'Lima Belas', 'Enam Belas', 'Tujuh Belas', 'Delapan Belas', 'Sembilan Belas'];
              const tens = ['', '', 'Dua Puluh', 'Tiga Puluh', 'Empat Puluh', 'Lima Puluh', 'Enam Puluh', 'Tujuh Puluh', 'Delapan Puluh', 'Sembilan Puluh'];
              
              const int = Math.floor(num);
              const decimal = Math.round((num - int) * 10);
              let result = '';

              if (int === 0) result = 'Nol';
              else if (int < 10) result = ones[int];
              else if (int < 20) result = teens[int - 10];
              else if (int < 100) {
                result = tens[Math.floor(int / 10)];
                if (int % 10 > 0) result += ' ' + ones[int % 10];
              } else if (int === 100) result = 'Seratus';

              if (decimal > 0) result += ' Koma ' + ones[decimal];
              return result;
            };

            const subjectList = Object.entries(subjectScores)
              .map(([name, scores], idx) => ({
                no: idx + 1,
                subject: name,
                avgScore: scores.length > 0 ? (scores.reduce((a, b) => a + b) / scores.length).toFixed(1) : '0',
              }))
              .sort((a, b) => a.no - b.no);

            const allScores = subjectList.map(s => parseFloat(s.avgScore)).filter(s => s > 0);
            const overallAvg = allScores.length > 0 ? (allScores.reduce((a, b) => a + b) / allScores.length).toFixed(2) : '0';

            return (
              <>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '8%' }}>NO</th>
                      <th style={{ width: '50%' }}>BIDANG STUDI</th>
                      <th style={{ width: '21%' }}>ANGKA</th>
                      <th style={{ width: '21%' }}>HURUF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectList.map((item) => (
                      <tr key={item.subject}>
                        <td className="center">{item.no}</td>
                        <td>{item.subject}</td>
                        <td className="center font-bold">{item.avgScore}</td>
                        <td className="center font-bold">{numberToIndonesian(parseFloat(item.avgScore))}</td>
                      </tr>
                    ))}
                    <tr className="summary">
                      <td colSpan={2} className="right">Rata-rata</td>
                      <td className="center font-bold">{overallAvg}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </>
            );
          })()}

          {/* Attendance Section */}
          <div className="section-title">B. ABSENSI</div>
          <table>
            <thead>
              <tr>
                <th>Hadir</th>
                <th>Sakit</th>
                <th>Izin</th>
                <th>Alfa</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="center font-bold">{reportData.attendance.HADIR}</td>
                <td className="center font-bold">{reportData.attendance.SAKIT}</td>
                <td className="center font-bold">{reportData.attendance.IZIN}</td>
                <td className="center font-bold">{reportData.attendance.ALFA}</td>
              </tr>
            </tbody>
          </table>

          {/* Footer */}
          <div className="footer">
            <div className="signature">
              <p>Diketahui,</p>
              <p className="text-sm">{new Date().toLocaleDateString('id-ID')}</p>
              <div className="signature-line">{reportData.school.principal}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ReportDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <ReportDetailContent />
    </Suspense>
  );
}
