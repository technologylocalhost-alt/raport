'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Download } from 'lucide-react';

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
  rawScore: number;  // Score dari NilaiApprove.score untuk kolom الأرقام
  letterGrade: string;
  predicate: string;
  hasApproval?: boolean;
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
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(-1);

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

  // Helper: Format score - only show decimals if they exist
  const formatScore = (score: number): string => {
    if (score % 1 === 0) {
      return Math.floor(score).toString();
    }
    return score.toFixed(1);
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

  // Helper: Normalize subject name for deduplication (removes special chars, extra spaces)
  const normalizeSubjectName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[`'´ʹ]/g, '')  // Remove backticks and similar marks
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();
  };

  // Helper: Process subject scores with approved grades
  const processSubjectScores = (approvedGrades: any[], subjects: any[]): SubjectScore[] => {
    
    // Create a map of approved grades by subject ID
    const gradesMap: { [key: string]: any } = {};
    approvedGrades.forEach((grade) => {
      gradesMap[grade.subjectId] = grade;
    });

    // Process all subjects (with or without approved grades)
    const resultMap: { [key: string]: any } = {};
    
    subjects.forEach((subject: any) => {
      const subjectId = subject.subjectId || subject.id;
      const subjectCode = subject.subject?.code || subject.code || '';
      const approved = gradesMap[subjectId];
      
      // Handle both master subjects (flat) and nested subjects
      const subjectName = subject.subject?.name || subject.name || '';
      const subjectArabicName = subject.subject?.nameArabic || subject.nameArabic || '';
      
      // Get averageSubject from database (المعدلة للفصل - semester average)
      let averageScore = 0;
      let rawScore = 0;  // Score dari NilaiApprove.score
      if (approved) {
        // averageSubject is the semester average (المعدلة للفصل)
        averageScore = approved.averageSubject ? parseFloat(String(approved.averageSubject)) : 0;
        // score is the raw numeric score (الأرقام)
        rawScore = approved.score ? parseFloat(approved.score) : 0;
      }
      
      const letterGrade = getLetterGrade(averageScore);
      
      const newSubject = {
        subject: subjectName,
        subjectCode: subjectCode,
        subjectArabicName: subjectArabicName,
        kkm: 0,  // KKM tidak ada di database, default 0
        scores: approved 
          ? [
              { type: 'DAILY', score: parseFloat(approved.dailyScore || 0) },
              { type: 'MID', score: parseFloat(approved.midScore || 0) },
              { type: 'FINAL', score: parseFloat(approved.finalScore || 0) },
            ].filter(s => s.score > 0)
          : [],
        averageScore,
        rawScore,  // Score dari NilaiApprove.score untuk kolom الأرقام
        letterGrade,
        predicate: getPredicate(letterGrade),
        hasApproval: !!approved,
      };

      // Deduplicate using multiple strategies:
      // 1. Primary key: subject code if present
      // 2. Fallback: normalized subject name
      // 3. Also check normalized version to catch variants with special chars
      let primaryKey = subjectCode || normalizeSubjectName(subjectName);
      let normalizedNameKey = normalizeSubjectName(subjectName);
      
      // Check both keys for duplicates
      let existingKey = primaryKey;
      let existing = resultMap[primaryKey];
      
      if (!existing && primaryKey !== normalizedNameKey) {
        // If primary key didn't find it, try the normalized name key
        existingKey = normalizedNameKey;
        existing = resultMap[normalizedNameKey];
      }
      
      if (existing) {
        // Keep the one with approval, or if both have approval/no-approval, keep highest score
        if (newSubject.hasApproval && !existing.hasApproval) {
          resultMap[existingKey] = newSubject;
        } else if (newSubject.hasApproval && existing.hasApproval && newSubject.averageScore > existing.averageScore) {
          resultMap[existingKey] = newSubject;
        }
      } else {
        // Use primary key as the storage key
        resultMap[primaryKey] = newSubject;
      }
    });
    
    const result = Object.values(resultMap)
      .sort((a, b) => {
        // Sort by subject code alphanumeric (A1, A2, B1, B2, etc)
        const codeA = a.subjectCode || '';
        const codeB = b.subjectCode || '';
        
        // Alphanumeric sort
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
      });
    
    return result;
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
      const classObj = classData.data || {};
      const school = classObj;
      
      console.log('[Raport] Class data loaded:', {
        classId: classObj.id,
        className: classObj.name,
        levelId: classObj.levelId,
        allProps: Object.keys(classObj),
      });

      // Fetch student data
      const studentResponse = await fetch(`/api/admin/classes/${classId}/students?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let student: Student = { 
        id: studentId || '', 
        name: 'N/A', 
        studentNo: 'N/A', 
        birthDate: '', 
        class: classObj.name || '-'
      };

      if (studentResponse.ok) {
        const studentData = await studentResponse.json();
        if (studentData.success && Array.isArray(studentData.data)) {
          // Store all students for navigation
          const students = studentData.data.map((s: any) => ({
            id: s.id,
            name: s.name || 'N/A',
            studentNo: s.studentNo || 'N/A',
            birthDate: s.birthDate || '',
            class: classObj.name || '-',
          }));
          setAllStudents(students);
          
          // Find current student index
          const index = students.findIndex((s: any) => s.id === studentId);
          setCurrentStudentIndex(index >= 0 ? index : 0);
          
          const foundStudent = studentData.data.find((s: any) => s.id === studentId);
          if (foundStudent) {
            student = {
              id: foundStudent.id,
              name: foundStudent.name || 'N/A',
              studentNo: foundStudent.studentNo || 'N/A',
              birthDate: foundStudent.birthDate || '',
              class: classObj.name || '-',
            };
          }
        }
      }

      // Fetch class subjects (all subjects registered in this class)
      let classSubjects: any[] = [];
      const classSubjectsResponse = await fetch(
        `/api/admin/classes/${classId}/subjects`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (classSubjectsResponse.ok) {
        const classSubjectsData = await classSubjectsResponse.json();
        if (classSubjectsData.success && Array.isArray(classSubjectsData.data)) {
          classSubjects = classSubjectsData.data;
          console.log('[Raport] Class subjects loaded:', classSubjects.length);
        }
      }

      // Fetch all master subjects for this level
      let masterSubjects: any[] = [];
      try {
        const subjectsResponse = await fetch(
          `/api/admin/subjects?levelId=${classObj.levelId}&limit=100`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (subjectsResponse.ok) {
          const subjectsData = await subjectsResponse.json();
          console.log('[Raport] Master subjects response:', subjectsData);
          if (subjectsData.success && Array.isArray(subjectsData.data)) {
            masterSubjects = subjectsData.data;
            console.log('[Raport] Loaded master subjects:', masterSubjects.length);
          }
        } else {
          console.log('[Raport] Master subjects fetch failed:', subjectsResponse.status);
        }
      } catch (err) {
        console.warn('Could not fetch master subjects by level:', err);
      }

      // Fetch approved grades first, BEFORE we decide what subjects to display
      let approvedGrades: any[] = [];
      try {
        let approvedData: any = null;
        
        try {
          const approvedResponse = await fetch(
            `/api/wali-kelas/nilai-approve?studentId=${studentId}&classId=${classId}&limit=100`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (approvedResponse.ok) {
            approvedData = await approvedResponse.json();
            console.log('[Raport] NilaiApprove endpoint success:', approvedData);
          } else {
            console.log('[Raport] NilaiApprove endpoint error:', approvedResponse.status);
          }
        } catch (err) {
          console.warn('[Raport] NilaiApprove fetch error:', err);
        }

        // If primary endpoint failed, try fallback endpoint
        if (!approvedData?.success) {
          console.log('[Raport] Trying fallback: grades-for-approval');
          const fallbackResponse = await fetch(
            `/api/wali-kelas/grades-for-approval?classId=${classId}&studentId=${studentId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (fallbackResponse.ok) {
            approvedData = await fallbackResponse.json();
            console.log('[Raport] Fallback endpoint success:', approvedData);
          } else {
            console.log('[Raport] Fallback endpoint error:', fallbackResponse.status);
          }
        }

        // Extract grades from response
        if (approvedData?.success && approvedData.data) {
          console.log('[Raport] Response structure:', Object.keys(approvedData.data));
          
          if (Array.isArray(approvedData.data)) {
            // Direct array
            approvedGrades = approvedData.data;
            console.log('[Raport] Direct array:', approvedGrades.length);
          } else if (approvedData.data.data && Array.isArray(approvedData.data.data)) {
            // Nested structure: { data: [...], total: N }
            approvedGrades = approvedData.data.data;
            console.log('[Raport] Extracted nested data.data array:', approvedGrades.length);
          } else if (approvedData.data.grades && Array.isArray(approvedData.data.grades)) {
            approvedGrades = approvedData.data.grades;
            console.log('[Raport] Extracted data.grades array:', approvedGrades.length);
          } else if (approvedData.data.subjectsByClass && Array.isArray(approvedData.data.subjectsByClass)) {
            // Handle grades-for-approval format
            approvedGrades = approvedData.data.subjectsByClass;
            console.log('[Raport] Extracted data.subjectsByClass array:', approvedGrades.length);
          } else {
            console.log('[Raport] Could not extract grades - unexpected response structure');
            console.log('[Raport] Response was:', JSON.stringify(approvedData.data).slice(0, 200));
          }
        } else {
          console.log('[Raport] No success or data in approvedData');
        }
      } catch (err) {
        console.warn('Could not fetch approved grades:', err);
      }

      // If we have approved grades but no master subjects, extract subjects from grades
      let subjectsToDisplay: any[] = [];
      if (masterSubjects.length > 0) {
        subjectsToDisplay = masterSubjects;
        console.log('[Raport] Using master subjects:', masterSubjects.length);
      } else if (classSubjects.length > 0) {
        subjectsToDisplay = classSubjects;
        console.log('[Raport] Using class subjects:', classSubjects.length);
      } else if (approvedGrades.length > 0) {
        // Extract unique subjects from approved grades
        const subjectMap = new Map();
        approvedGrades.forEach((grade) => {
          if (grade.subject && !subjectMap.has(grade.subjectId)) {
            subjectMap.set(grade.subjectId, {
              id: grade.subjectId,
              subject: grade.subject,
              subjectId: grade.subjectId,
            });
          }
        });
        subjectsToDisplay = Array.from(subjectMap.values());
        console.log('[Raport] Extracted subjects from approved grades:', subjectsToDisplay.length);
      }
      
      console.log('[Raport] Final state before processing:', {
        masterSubjects: masterSubjects.length,
        classSubjects: classSubjects.length,
        approvedGrades: approvedGrades.length,
        subjectsToDisplay: subjectsToDisplay.length,
      });

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

      const subjectScores = processSubjectScores(approvedGrades, subjectsToDisplay);
      
      // Debug: Check for IMLA ARABI entries (more specific filter)
      const imlaEntries = subjectScores.filter(s => 
        (s.subjectCode === 'A1') || 
        (s.subject === 'IMLA` ARABI' || s.subject === 'IMLA ARABI') ||
        (s.subjectArabicName?.includes('الإمـلاء') && !s.subjectArabicName?.includes('إنجليزي'))
      );
      console.log('[Raport] IMLA ARABI entries in subjectScores:', imlaEntries);
      console.log('[Raport] IMLA ARABI detailed:', imlaEntries.map(e => ({
        subject: e.subject,
        code: e.subjectCode,
        averageScore: e.averageScore,
        kkm: e.kkm,
        hasApproval: e.hasApproval,
        letterGrade: e.letterGrade,
      })));
      console.log('[Raport] All subjectScores (first 5):', subjectScores.slice(0, 5).map(s => ({
        subject: s.subject,
        code: s.subjectCode,
        averageScore: s.averageScore,
        kkm: s.kkm,
        hasApproval: s.hasApproval,
      })));
      
      console.log('[Raport] Final processing:', {
        approvedGradesCount: approvedGrades.length,
        subjectsToDisplayCount: subjectsToDisplay.length,
        subjectScoresCount: subjectScores.length,
      });

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

  const handleDownloadPDF = async () => {
    try {
      if (!reportData) {
        alert('Data raport tidak tersedia');
        return;
      }

      const response = await fetch('/api/wali-kelas/generate-pdf-puppeteer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error || 'Gagal membuat PDF');
      }

      const { pdf, fileName } = await response.json();

      // Download PDF
      const link = document.createElement('a');
      link.href = pdf;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert(`Gagal membuat PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handlePreviousStudent = () => {
    if (currentStudentIndex > 0) {
      const previousStudent = allStudents[currentStudentIndex - 1];
      router.push(
        `/wali-kelas/raport-arab/detail?classId=${classId}&studentId=${previousStudent.id}`
      );
    }
  };

  const handleNextStudent = () => {
    if (currentStudentIndex < allStudents.length - 1) {
      const nextStudent = allStudents[currentStudentIndex + 1];
      router.push(
        `/wali-kelas/raport-arab/detail?classId=${classId}&studentId=${nextStudent.id}`
      );
    }
  };

  const handleSeeAllStudents = () => {
    router.push(`/wali-kelas/raport-arab/bulk-review`);
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
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
        
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
          font-family: 'Amiri', 'Traditional Arabic', 'Arial Unicode MS', serif;
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
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          padding: 6px 6px;
          font-size: 12px;
          line-height: 1.2;
          font-family: 'Amiri', 'Traditional Arabic', serif;
          direction: rtl;
          position: relative;
          overflow: visible;
          display: flex;
          flex-direction: column;
        }

        .watermark-bg {
          position: absolute;
          top: 40%;
          left: 50%;
          transform: translate(-50%, -50%);
          opacity: 1;
          z-index: 1;
          pointer-events: none;
        }

        .watermark-bg img {
          width: 1000px;
          height: auto;
        }
        
        .page-content {
          overflow: visible;
          position: relative;
          z-index: 10;
        }
        
        .footer-section {
          margin-top: auto;
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

        /* Hide sidebar on raport detail page */
        aside,
        nav:not(.a4-wrapper nav),
        .sidebar {
          display: none !important;
        }

        @media print {
          * {
            margin: 0 !important;
            padding: 0 !important;
          }

          html, body {
            width: 215mm !important;
            height: 330mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          body > * {
            display: none !important;
          }

          body > div:nth-child(n) {
            display: block !important;
          }

          body > div > .a4-wrapper {
            display: flex !important;
          }

          aside, nav, .sidebar, .navbar, .toolbar, footer {
            display: none !important;
          }

          .toolbar {
            display: none !important;
          }

          .a4-wrapper {
            background: white !important;
            padding: 0 !important;
            min-height: auto !important;
            margin: 0 !important;
            width: 100% !important;
            display: flex !important;
            justify-content: center !important;
          }

          .a4-page {
            width: 215mm !important;
            height: 330mm !important;
            padding: 8px 8px !important;
            box-shadow: none !important;
            margin: 0 !important;
            background: white !important;
            page-break-after: always !important;
            display: block !important;
            font-size: 12px !important;
            line-height: 1.2 !important;
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
          font-family: 'Amiri', 'Traditional Arabic', serif;
          font-size: 13px;
          margin-top: 3px;
        }
        
        th, td {
          border: 1px solid #000;
          padding: 5px;
          text-align: center;
          vertical-align: middle;
        }
        
        thead th {
          background: #e9e9e9;
          font-weight: bold;
          padding: 8px;
        }
        
        tbody td {
          padding: 4px 5px;
        }
        
        h1 {
          font-size: 16px;
          margin-top: 18px;
          margin-bottom: 1px;
          text-align: center;
          font-weight: bold;
        }
        
        .ar {
          direction: rtl;
          font-family: 'Amiri', 'Traditional Arabic', serif;
        }
        
        table.no-border td {
          border: none;
          padding: 2px 6px;
        }

        .center { text-align: center; }
        .right { text-align: right; }

        .arabic-text {
          font-family: 'Amiri', 'Traditional Arabic', serif;
        }

        .info-table {
          margin-bottom: 1px;
        }
        
        .info-table td {
          font-size: 12px;
          padding: 2px 0;
          border: none;
        }
        
        .info-table td.label {
          font-weight: bold;
        }

        .section-title {
          font-weight: bold;
          margin-top: 3px;
          margin-bottom: 1px;
          font-size: 13px;
        }

        .footer-section table td {
          border: none !important;
        }

        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          h1 {
            font-size: 19px !important;
            margin-bottom: 8px !important;
          }
          
          table {
            margin-top: 8px !important;
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
        
        {/* Navigation Buttons */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handlePreviousStudent}
            disabled={currentStudentIndex <= 0}
            className={`flex items-center gap-2 px-4 py-2 rounded ${
              currentStudentIndex <= 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gray-400 text-white hover:bg-gray-500'
            }`}
          >
            ← Siswa Sebelumnya
          </button>
          
          <button
            onClick={handleSeeAllStudents}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Lihat Semua Siswa
          </button>
          
          <button
            onClick={handleNextStudent}
            disabled={currentStudentIndex >= allStudents.length - 1}
            className={`flex items-center gap-2 px-4 py-2 rounded ${
              currentStudentIndex >= allStudents.length - 1
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gray-400 text-white hover:bg-gray-500'
            }`}
          >
            Siswa Berikutnya →
          </button>

          <span className="text-gray-700 font-medium px-4 ml-4">
            Siswa {currentStudentIndex >= 0 ? currentStudentIndex + 1 : 1} / {allStudents.length}
          </span>
        </div>

        <div className="h-6 w-px bg-gray-300 ml-4"></div>
        
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ml-4"
        >
          <Download size={20} />
          Download PDF
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ml-2"
        >
          <Printer size={20} />
          Cetak
        </button>
      </div>

      <div className="a4-wrapper">
        <div className="a4-page">
          <div className="watermark-bg">
            <img src="/namapondok.png" alt="Trademark" />
          </div>
          <div className="page-content">
          {/* Header */}
          <h1 className="arabic-text center" style={{ fontFamily: "'Amiri', 'Traditional Arabic', serif", fontSize: '19px', marginBottom: '8px', textAlign: 'center', fontWeight: 'bold' }}>بسم الله الرحمن الرحيم</h1>
          {/* Header Info */}
          <table className="no-border ar info-table" style={{ marginBottom: '1px' }}>
            <tbody>
              <tr>
                <td className="label">الاسم</td>
                <td>: {reportData.student.name || '-'}</td>
                <td className="right label">رقم دفتر القيد</td>
                <td>: {reportData.student.studentNo}</td>
                <td className="right label">الفصل</td>
                <td>: {reportData.student.class || '-'}</td>
              </tr>
            </tbody>
          </table>

          {/* Tabel Nilai Format Arabic RTL */}
          <table className="ar" style={{ marginTop: '2px' }}>
            <thead>
              <tr>
                {/* BLOK KANAN (Column 1-4) */}
                <th rowSpan={2} style={{ width: '14%' }} className="arabic-text">المواد</th>
                <th colSpan={3} style={{ width: '36%' }} className="arabic-text">الدرجة</th>

                {/* BLOK KIRI (Column 5-8) */}
                <th rowSpan={2} style={{ width: '14%' }} className="arabic-text">المواد</th>
                <th colSpan={3} style={{ width: '36%' }} className="arabic-text">الدرجة</th>
              </tr>
              <tr>
                {/* Sub kolom kanan */}
                <th className="arabic-text" style={{ width: '12%' }}>المعدلة للفصل</th>
                <th className="arabic-text" style={{ width: '12%' }}>الأرقام</th>
                <th className="arabic-text" style={{ width: '12%' }}>الحروف</th>

                {/* Sub kolom kiri */}
                <th className="arabic-text" style={{ width: '12%' }}>المعدلة للفصل</th>
                <th className="arabic-text" style={{ width: '12%' }}>الأرقام</th>
                <th className="arabic-text" style={{ width: '12%' }}>الحروف</th>
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
                      <td><strong>{rightSubject ? (rightSubject.hasApproval ? toArabicNumerals(rightSubject.averageScore.toFixed(1)) : '—') : '—'}</strong></td>
                      <td><strong>{rightSubject ? (rightSubject.hasApproval ? toArabicNumerals(formatScore(rightSubject.rawScore)) : '—') : '—'}</strong></td>
                      <td><strong>{rightSubject ? (rightSubject.hasApproval ? scoreToArabicText(rightSubject.rawScore) : '—') : '—'}</strong></td>

                      {/* BLOK KIRI (Left side) */}
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{leftSubject ? (leftSubject.subjectArabicName || leftSubject.subject) : '—'}</td>
                      <td><strong>{leftSubject ? (leftSubject.hasApproval ? toArabicNumerals(leftSubject.averageScore.toFixed(1)) : '—') : '—'}</strong></td>
                      <td><strong>{leftSubject ? (leftSubject.hasApproval ? toArabicNumerals(formatScore(leftSubject.rawScore)) : '—') : '—'}</strong></td>
                      <td><strong>{leftSubject ? (leftSubject.hasApproval ? scoreToArabicText(leftSubject.rawScore) : '—') : '—'}</strong></td>
                    </tr>
                  );
                }

                return rows;
              })()}
            </tbody>
          </table>

            {/* Rekap */}
            <table style={{ marginTop: '8px' }} className="ar">
            <tbody>
              <tr>
              <th>المجموع الكليّ</th>
              <td className="center">
                <strong>
                {toArabicNumerals(formatScore(reportData.subjectScores.filter(s => s.hasApproval).reduce((sum, s) => sum + s.rawScore, 0)))}
                </strong>
              </td>
              <th>المعدل العام</th>
              <td className="center">
                <strong>
                {toArabicNumerals(formatScore(reportData.subjectScores.filter(s => s.hasApproval).reduce((sum, s) => sum + s.rawScore, 0) / reportData.subjectScores.filter(s => s.hasApproval).length))}
                </strong>
              </td>
              </tr>
            </tbody>
            </table>

          {/* Rekap */}
            <table style={{ marginTop: '8px' }} className="ar">
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
          <table style={{ marginTop: '2px', fontSize: '12px' }} className="ar">
            <tbody>
              <tr>
                <th>تقدير الدرجات: ١–٣ : ضعيف جداً،   ٤–٥ : ضعيف، ٦ : مقبول، ٧ : جيد، ٨ : جيد جداً، ٩–١٠ : ممتاز </th>
              </tr>
            </tbody>
          </table>
          </div> {/* end page-content */}
          
          <div className="footer-section">
            {/* TTD dan Info Footer */}
            <table className="ar" style={{ marginTop: '2px', width: '100%', border: 'none' }}>
            <tbody>
              <tr style={{ height: 'auto' }}>
              {/* Kolom kanan (tanggal laporan) */}
              <td style={{ width: '33%', textAlign: 'right', padding: '8px', fontSize: '12px', fontFamily: "'Amiri', 'Traditional Arabic', serif", verticalAlign: 'top', border: 'none' }}>
              <div style={{ marginBottom: '50px', paddingTop: '8px' }}>
                تقرير بدار السلام لاهات، في 21 يونيو 2026
              </div>
              </td>

              {/* Kolom tengah (pimpinan + nama) */}
              <td style={{ width: '34%', textAlign: 'center', padding: '8px', fontSize: '12px', fontFamily: "'Amiri', 'Traditional Arabic', serif", verticalAlign: 'top', border: 'none' }}>
              <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
              مدير المعهد دار السلام لاهات
              </div>
              
              <div style={{ borderTop: '1px solid #000', marginTop: '45px', paddingTop: '8px' }}></div>
              <div style={{ marginTop: '2px', fontSize: '12px' }}>
              الأستاذ محمد رومي أوكتاريوس،
              </div>
              </td>

              {/* Kolom kiri (catatan + nilai) */}
              <td style={{ width: '33%', textAlign: 'center', padding: '8px', fontSize: '12px', fontFamily: "'Amiri', 'Traditional Arabic', serif", verticalAlign: 'top', border: 'none' }}>
              
              <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
              الملاحظة
              </div>
              <div style={{ fontSize: '14px', marginBottom: '12px', fontWeight: 'bold' }}>
              ضعيف جدًا
              </div>
              <div style={{ fontSize: '10px', marginTop: '40px', paddingTop: '8px', borderTop: '1px solid #ccc' }}>
              SERIAL: UAS-SMT-2-24/25-PA-31
              </div>
              </td>
              </tr>
            </tbody>
            </table>
          </div> {/* end footer-section */}
        </div> {/* end a4-page */}
      </div> {/* end a4-wrapper */}
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
