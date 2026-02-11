'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  studentNo: string;
  birthDate?: string;
  class?: string;
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
  competencyName: string;
  subjectName: string;
  score: string;
  assessmentType: string;
}

interface SubjectScore {
  subject: string;
  subjectCode?: string;
  subjectArabicName?: string;
  kkm: number;
  scores?: { type: string; score: number }[];
  averageScore: number;
  letterGrade: string;
  predicate: string;
}

interface ReportData {
  student: Student;
  subjectScores: SubjectScore[];
  attendance: {
    HADIR: number;
    SAKIT: number;
    IZIN: number;
    ALFA: number;
  };
  semester: string;
  schoolYear: string;
  school: School;
}

function RaportArabDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = searchParams.get('classId');
  const studentId = searchParams.get('studentId');

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Helper: Convert numeric score to letter grade (1-10 scale)
  const getLetterGrade = (score: number): string => {
    if (score >= 8.5) return 'أ';
    if (score >= 7.0) return 'ب';
    if (score >= 5.5) return 'ج';
    return 'د';
  };

  // Helper: Convert number to Arabic numerals
  const toArabicNumerals = (num: number | string): string => {
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(num).split('').map(digit => {
      if (digit >= '0' && digit <= '9') {
        return arabicDigits[parseInt(digit)];
      }
      return digit;
    }).join('');
  };

  // Helper: Convert numeric score to Arabic text
  const scoreToArabicText = (score: number): string => {
    const onesArabic = ['', 'واحد', 'اثنان', 'ثلاث', 'أربع', 'خمس', 'ست', 'سبع', 'ثمان', 'تسع'];
    const teensArabic = ['عشرة', 'احدى عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    const tensArabic = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    
    const int = Math.floor(score);
    const decimal = Math.round((score - int) * 10);
    let result = '';

    if (int === 0) result = 'صفر';
    else if (int < 10) result = onesArabic[int];
    else if (int < 20) result = teensArabic[int - 10];
    else if (int < 100) {
      result = tensArabic[Math.floor(int / 10)];
      if (int % 10 > 0) result = onesArabic[int % 10] + ' و' + result;
    } else if (int === 100) result = 'مئة';

    if (decimal > 0) {
      if (decimal === 5) {
        result += ' و نصف';
      } else {
        result += ' و ' + onesArabic[decimal];
      }
    }
    return result;
  };

  // Helper: Convert letter grade to predicate
  const getPredicate = (letterGrade: string): string => {
    const predicates: { [key: string]: string } = {
      'A': 'ممتاز',
      'B': 'جيد جداً',
      'C': 'جيد',
      'D': 'مقبول',
    };
    return predicates[letterGrade] || '-';
  };

  // Helper: Convert numeric score to Indonesian text
  const scoreToIndonesianText = (score: number): string => {
    const ones = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan'];
    const teens = ['Sepuluh', 'Sebelas', 'Dua Belas', 'Tiga Belas', 'Empat Belas', 'Lima Belas', 'Enam Belas', 'Tujuh Belas', 'Delapan Belas', 'Sembilan Belas'];
    const tens = ['', '', 'Dua Puluh', 'Tiga Puluh', 'Empat Puluh', 'Lima Puluh', 'Enam Puluh', 'Tujuh Puluh', 'Delapan Puluh', 'Sembilan Puluh'];
    
    const int = Math.floor(score);
    const decimal = Math.round((score - int) * 10);
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

  // Helper: Process subject scores with all class subjects
  const processSubjectScores = (grades: Grade[], classSubjects: string[] = [], subjectCodeMap: { [key: string]: string } = {}, subjectArabicMap: { [key: string]: string } = {}): SubjectScore[] => {
    const subjectMap: { 
      [key: string]: { 
        scores: number[]; 
        assessmentScores: { type: string; score: number }[] 
      } 
    } = {};

    // Initialize all class subjects
    classSubjects.forEach(subject => {
      if (!subjectMap[subject]) {
        subjectMap[subject] = { 
          scores: [], 
          assessmentScores: [] 
        };
      }
    });

    grades.forEach((grade) => {
      if (!subjectMap[grade.subjectName]) {
        subjectMap[grade.subjectName] = { 
          scores: [], 
          assessmentScores: [] 
        };
      }
      const scoreNum = parseFloat(grade.score);
      if (!isNaN(scoreNum) && scoreNum > 0) {
        subjectMap[grade.subjectName].scores.push(scoreNum);
        subjectMap[grade.subjectName].assessmentScores.push({
          type: grade.assessmentType || 'DAILY',
          score: scoreNum,
        });
      }
    });

    return Object.entries(subjectMap)
      .map(([subject, data]) => {
        const averageScore = data.scores.length > 0 
          ? Math.round((data.scores.reduce((a, b) => a + b) / data.scores.length) * 100) / 100
          : 0;
        const letterGrade = getLetterGrade(averageScore);

        // Create scores array with daily, mid, final
        const scoresArray = [
          { type: 'DAILY', score: data.assessmentScores.find(s => s.type === 'DAILY')?.score || 0 },
          { type: 'MID', score: data.assessmentScores.find(s => s.type === 'MID')?.score || 0 },
          { type: 'FINAL', score: data.assessmentScores.find(s => s.type === 'FINAL')?.score || averageScore },
        ].filter(s => s.score > 0);

        // If not enough types, fill with average
        if (scoresArray.length < 3) {
          while (scoresArray.length < 3) {
            scoresArray.push({ type: ['DAILY', 'MID', 'FINAL'][scoresArray.length], score: averageScore });
          }
        }

        return {
          subject,
          subjectCode: subjectCodeMap[subject] || '',
          subjectArabicName: subjectArabicMap[subject] || '',
          kkm: 6,
          scores: scoresArray,
          averageScore,
          letterGrade,
          predicate: getPredicate(letterGrade),
        };
      })
      .sort((a, b) => {
        // Sort by subject code alphanumeric (A1, A2, B1, B2, etc)
        const codeA = a.subjectCode || '';
        const codeB = b.subjectCode || '';
        
        // Alphanumeric sort
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
      });
  };

  // Validation: Check required parameters on mount
  useEffect(() => {
    if (!classId || classId.trim() === '') {
      setError('ID Kelas tidak valid');
      setIsLoading(false);
      return;
    }
    
    if (!studentId || studentId.trim() === '') {
      setError('ID Siswa tidak valid');
      setIsLoading(false);
      return;
    }

    if (classId && studentId) {
      fetchReportData();
    }
  }, [classId, studentId]);

  async function fetchReportData() {
    try {
      setError('');
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');

      if (!token || token.trim() === '') {
        setError('Sesi Anda telah berakhir. Silakan login kembali');
        setTimeout(() => router.push('/login'), 1500);
        setIsLoading(false);
        return;
      }

      // Fetch class data
      const classResponse = await fetch(`/api/admin/classes/${classId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (classResponse.status === 401) {
        setError('Sesi Anda telah berakhir. Silakan login kembali');
        setTimeout(() => router.push('/login'), 1500);
        setIsLoading(false);
        return;
      }

      if (!classResponse.ok) {
        setError('Data kelas tidak ditemukan');
        setIsLoading(false);
        return;
      }

      const classData = await classResponse.json();
      const school = classData.data || {};

      // Fetch student data
      const studentResponse = await fetch(`/api/admin/classes/${classId}/students`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let student: Student = { 
        id: studentId || '', 
        name: 'N/A', 
        studentNo: 'N/A', 
        birthDate: '', 
        class: classData.data?.name || '-'
      };

      if (studentResponse.ok) {
        const studentData = await studentResponse.json();
        if (studentData.success && Array.isArray(studentData.data)) {
          const foundStudent = studentData.data.find((s: any) => s.id === studentId);
          if (foundStudent) {
            student = {
              id: foundStudent.id,
              name: foundStudent.name || 'N/A',
              studentNo: foundStudent.studentNo || 'N/A',
              birthDate: foundStudent.birthDate || '',
              class: classData.data?.name || '-',
            };
          }
        }
      }

      // Fetch grades
      const gradesResponse = await fetch(
        `/api/teacher/grades?studentId=${studentId}&classId=${classId}&limit=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      let grades: Grade[] = [];
      if (gradesResponse.ok) {
        const gradesData = await gradesResponse.json();
        if (gradesData.success && Array.isArray(gradesData.data)) {
          grades = gradesData.data.map((grade: any) => ({
            id: grade.id,
            competencyName: grade.competencyName || 'N/A',
            subjectName: grade.subjectName || 'N/A',
            score: String(grade.score || 0),
            assessmentType: grade.assessmentType || 'DAILY',
          }));
        }
      }

      // Fetch class subjects (all subjects registered in this class)
      const classSubjectsResponse = await fetch(
        `/api/admin/classes/${classId}/subjects`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      let classSubjects: string[] = [];
      let subjectCodeMap: { [key: string]: string } = {};
      let subjectArabicMap: { [key: string]: string } = {};
      if (classSubjectsResponse.ok) {
        const classSubjectsData = await classSubjectsResponse.json();
        if (classSubjectsData.success && Array.isArray(classSubjectsData.data)) {
          classSubjects = classSubjectsData.data
            .map((cs: any) => cs.subject?.name || cs.subjectName || '')
            .filter((s: string) => s);
          
          // Create mapping of subject name to code and arabic name for sorting and display
          classSubjectsData.data.forEach((cs: any) => {
            const subjectName = cs.subject?.name || cs.subjectName || '';
            const subjectCode = cs.subject?.code || '';
            const subjectArabic = cs.subject?.nameArabic || '';
            if (subjectName && subjectCode) {
              subjectCodeMap[subjectName] = subjectCode;
            }
            if (subjectName && subjectArabic) {
              subjectArabicMap[subjectName] = subjectArabic;
            }
          });
        }
      }

      // Fetch attendance
      const attendanceResponse = await fetch(
        `/api/teacher/students/${studentId}/attendance?classId=${classId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      let attendance = { HADIR: 0, SAKIT: 0, IZIN: 0, ALFA: 0 };
      if (attendanceResponse.ok) {
        const attendanceData = await attendanceResponse.json();
        if (attendanceData.success && attendanceData.data?.summary) {
          attendance = attendanceData.data.summary;
        }
      }

      const subjectScores = processSubjectScores(grades, classSubjects, subjectCodeMap, subjectArabicMap);

      setReportData({
        student,
        subjectScores,
        attendance,
        semester: 'Semester 2',
        schoolYear: '2024/2025',
        school: {
          id: school.id || '',
          name: 'Kementerian Agama Republik Indonesia',
          address: school.address || '',
          phone: school.phone || '',
          email: school.email || '',
          principal: school.principal || '',
        },
      });
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching report:', err);
      setError('Terjadi kesalahan saat memuat laporan');
      setIsLoading(false);
    }
  }

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Memuat raport...</p>
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
          font-family: 'Traditional Arabic', serif;
          color: black;
          background: white;
          overflow-x: hidden;
        }

        .a4-wrapper {
          background: #f5f5f5;
          padding: 40px 20px 20px 20px;
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          width: 100%;
          margin: 0;
        }

        .a4-page {
          width: 215mm;
          height: 330mm;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          padding: 25px 20px;
          font-size: 14px;
          line-height: 1.3;
          font-family: 'Traditional Arabic', serif;
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
            width: 215mm !important;
            height: 330mm !important;
            padding: 25px 20px !important;
            box-shadow: none !important;
            margin: 0 !important;
            page-break-after: always;
          }

          @page {
            size: 215mm 330mm;
            margin: 0;
            padding: 0;
          }
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-family: 'Traditional Arabic', serif;
          font-size: 14px;
        }
        
        th, td {
          border: 2px solid #000;
          padding: 6px;
          text-align: center;
        }
        
        thead th {
          background: #e9e9e9;
        }
        
        .ar {
          direction: rtl;
          font-family: 'Traditional Arabic', serif;
        }
        
        table.no-border td {
          border: none;
          padding: 2px 6px;
        }

        .center { text-align: center; }
        .right { text-align: right; }

        .arabic-text {
          font-family: 'Traditional Arabic', 'Arial', serif;
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
          className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-300 rounded"
        >
          <ArrowLeft size={20} />
          Kembali
        </button>
        <div className="h-6 w-px bg-gray-300"></div>
        <span className="text-gray-600 text-sm">Raport Peserta Didik Bahasa Arab - F4 (215 × 330 mm)</span>
        <button
          onClick={handlePrint}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
        >
          <Printer size={20} />
          Cetak
        </button>
      </div>

      <div className="a4-wrapper">
        <div className="a4-page">
          {/* Header */}
          <h1 className="arabic-text center" style={{ fontFamily: "'Traditional Arabic', serif", fontSize: '21px', marginBottom: '10px', textAlign: 'center' }}>بسم الله الرحمن الرحيم</h1>
          {/* Header Info */}
          <table className="no-border ar">
            <tbody>
              <tr>
                <td>الاسم</td>
                <td>: {reportData.student.name || '-'}</td>
                <td className="right">رقم دفتر القيد</td>
                <td>: {reportData.student.studentNo}</td>
                <td className="right">الفصل</td>
                <td>: {reportData.student.class || '-'}</td>
              </tr>
            </tbody>
          </table>

          {/* Tabel Nilai Format Arabic RTL */}
          <table className="ar" style={{ marginTop: '10px' }}>
            <thead>
              <tr>
                {/* BLOK KANAN (Column 1-4) */}
                <th rowSpan={2} style={{ width: '15%' }} className="arabic-text">المواد</th>
                <th colSpan={3} style={{ width: '35%' }} className="arabic-text">الدرجة</th>

                {/* BLOK KIRI (Column 5-8) */}
                <th rowSpan={2} style={{ width: '15%' }} className="arabic-text">المواد</th>
                <th colSpan={3} style={{ width: '35%' }} className="arabic-text">الدرجة</th>
              </tr>
              <tr>
                {/* Sub kolom kanan */}
                <th className="arabic-text">المعدلة للفصل</th>
                <th className="arabic-text">الأرقام</th>
                <th className="arabic-text">الحروف</th>

                {/* Sub kolom kiri */}
                <th className="arabic-text">المعدلة للفصل</th>
                <th className="arabic-text">الأرقام</th>
                <th className="arabic-text">الحروف</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const subjects = reportData.subjectScores;
                const rightColumn = subjects.slice(0, Math.ceil(subjects.length / 2));
                const leftColumn = subjects.slice(Math.ceil(subjects.length / 2));
                
                const maxRows = Math.max(leftColumn.length, rightColumn.length);
                const rows = [];

                for (let i = 0; i < maxRows; i++) {
                  const rightSubject = rightColumn[i];
                  const leftSubject = leftColumn[i];

                  rows.push(
                    <tr key={i}>
                      {/* BLOK KANAN (Right side) */}
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{rightSubject ? (rightSubject.subjectArabicName || rightSubject.subject) : '—'}</td>
                      <td>{rightSubject ? toArabicNumerals(rightSubject.kkm) : '—'}</td>
                      <td><strong>{rightSubject ? toArabicNumerals(rightSubject.averageScore.toFixed(1)) : '—'}</strong></td>
                      <td><strong>{rightSubject ? scoreToArabicText(rightSubject.averageScore) : '—'}</strong></td>

                      {/* BLOK KIRI (Left side) */}
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{leftSubject ? (leftSubject.subjectArabicName || leftSubject.subject) : '—'}</td>
                      <td>{leftSubject ? toArabicNumerals(leftSubject.kkm) : '—'}</td>
                      <td><strong>{leftSubject ? toArabicNumerals(leftSubject.averageScore.toFixed(1)) : '—'}</strong></td>
                      <td><strong>{leftSubject ? scoreToArabicText(leftSubject.averageScore) : '—'}</strong></td>
                    </tr>
                  );
                }

                return rows;
              })()}
            </tbody>
          </table>

            {/* Rekap */}
            <table style={{ marginTop: '10px' }} className="ar">
            <tbody>
              <tr>
              <th>الرتبة</th>
              <td className="center">---</td>
              <th>المعدل العام</th>
              <td className="center">
                <strong>
                {toArabicNumerals((reportData.subjectScores.reduce((sum, s) => sum + s.averageScore, 0) / reportData.subjectScores.length).toFixed(1))}
                </strong>
              </td>
              </tr>
            </tbody>
            </table>

          {/* Rekap */}
            <table style={{ marginTop: '10px' }} className="ar">
            <tbody>
              <tr>
              <th>السلوك</th>
              <td className="center">٨</td>
              <td className="center">ثمان</td>
              </tr>
              <tr>
              <th>المواظبة</th>
              <td className="center">٨</td>
              <td className="center">ثمان</td>
              </tr>
              <tr>
              <th>النظافة</th>
              <td className="center">٨</td>
              <td className="center">ثمان</td>
              </tr>
            </tbody>
            </table>

          {/* Catatan */}
          <table style={{ marginTop: '10px' }} className="ar">
            <tbody>
              <tr>
                <th>تقدير الدرجات: ١–٣ : ضعيف جداً،   ٤–٥ : ضعيف، ٦ : مقبول، ٧ : جيد، ٨ : جيد جداً، ٩–١٠ : ممتاز </th>
              </tr>
            </tbody>
          </table>

            {/* TTD dan Info Footer */}
            <table className="ar" style={{ marginTop: '30px', width: '100%' }}>
            <tbody>
              <tr>
                {/* Kolom kanan (tanggal laporan) */}
                <td style={{ width: '33%', textAlign: 'right', padding: '10px 10px 30px 10px', border: '1px solid #000', fontSize: '12px', fontFamily: "'Traditional Arabic', serif" }}>
                <div style={{ marginBottom: '40px' }}>
                  تقرير بدار السلام لاهات، في 21 يونيو 2026
                </div>
                </td>

              {/* Kolom tengah (pimpinan + nama) */}
                <td style={{ width: '44%', textAlign: 'center', padding: '10px', border: '1px solid #000', fontSize: '12px' }}>
                <div style={{ fontFamily: "'Traditional Arabic', serif", marginBottom: '5px' }}>
                مدير المعهد دار السلام لاهات
                </div>
                
                <div style={{ borderTop: '1px solid #000', marginTop: '40px', paddingTop: '5px' }}></div>
                <div style={{ fontFamily: "'Traditional Arabic', serif", marginBottom: '20px', marginTop: '8px' }}>
                الأستاذ محمد رومي أوكتاريوس،
                </div>
                </td>

              {/* Kolom kiri (catatan + nilai) */}
              <td style={{ width: '23%', textAlign: 'center', padding: '10px', border: '1px solid #000', fontSize: '12px' }}>
                
                <div style={{ fontFamily: "'Traditional Arabic', serif", marginBottom: '8px', fontWeight: 'bold' }}>
                الملاحظة
                </div>
                <div style={{ fontFamily: "'Traditional Arabic', serif", fontSize: '14px', marginBottom: '8px', fontWeight: 'bold' }}>
                ضعيف جدًا
                </div>
                <div style={{ fontSize: '10px', marginTop: '10px' }}>
                SERIAL: UAS-SMT-2-24/25-PA-31
                </div>
              </td>
              </tr>
            </tbody>
            </table>
        </div>
      </div>
    </>
  );
}

export default function RaportArabDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <RaportArabDetailContent />
    </Suspense>
  );
}
