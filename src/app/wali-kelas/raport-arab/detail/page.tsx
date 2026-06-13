/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, Eye } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { devError } from '@/lib/dev-log';

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

interface ApprovedGradeItem {
  subjectId?: string;
  subjectCode?: string;
  score?: string | number;
  averageSubject?: string | number;
  dailyScore?: string | number;
  midScore?: string | number;
  finalScore?: string | number;
  assessmentType?: string;
  mulahazoh?: string;
  nomorRaport?: string;
  studentId?: string;
  subject?: {
    code?: string;
    name?: string;
    nameArabic?: string;
  };
}

interface SubjectListItem {
  id?: string;
  subjectId?: string;
  code?: string;
  name?: string;
  nameArabic?: string;
  subject?: {
    code?: string;
    name?: string;
    nameArabic?: string;
  };
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
  mulahazoh?: string;
  nomorRaport?: string;
  suluk?: string;
  muazobah?: string;
  nazofah?: string;
  semesterEndDate?: Date | string;
}

function RaportArabDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = searchParams.get('classId');
  const studentId = searchParams.get('studentId');
  const assessmentType = searchParams.get('assessmentType');

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(-1);

  const assessmentTypeLabels: Record<string, string> = {
    'UTS_1': 'UTS Semester 1',
    'UAS_1': 'UAS Semester 1',
    'UTS_2': 'UTS Semester 2',
    'UAS_2': 'UAS Semester 2',
    'FINAL_EXAM_1': 'Ujian Akhir Gel 1',
    'FINAL_EXAM_2': 'Ujian Akhir Gel 2',
  };

  // Helper: Convert numeric score to letter grade (1-10 scale)
  const getLetterGrade = useCallback((score: number): string => {
    if (score >= 8.5) return 'أ';
    if (score >= 7.0) return 'ب';
    if (score >= 5.5) return 'ج';
    return 'د';
  }, []);

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

  // Helper: Format date to Arabic format (e.g., "في 21 يونيو 2026")
  const formatDateToArabic = (date: Date | string | undefined): string => {
    if (!date) return 'في ٢١ يونيو ٢٠٢٦'; // fallback to original
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const day = dateObj.getDate();
    const month = dateObj.getMonth();
    const year = dateObj.getFullYear();
    
    const monthsArabic = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    
    const arabicDay = toArabicNumerals(day);
    const arabicYear = toArabicNumerals(year);
    
    return `في ${arabicDay} ${monthsArabic[month]} ${arabicYear}`;
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
  const getPredicate = useCallback((letterGrade: string): string => {
    const predicates: Record<string, string> = {
      A: 'ممتاز',
      B: 'جيد جداً',
      C: 'جيد',
      D: 'مقبول',
    };
    return predicates[letterGrade] || '-';
  }, []);

  // Helper: Format score - only show decimals if they exist
  const formatScore = (score: number): string => {
    if (score % 1 === 0) {
      return Math.floor(score).toString();
    }
    return score.toFixed(1);
  };

  // Helper: Normalize subject name for deduplication (removes special chars, extra spaces)
  const normalizeSubjectName = useCallback((name: string): string => {
    return name
      .toLowerCase()
      .replace(/[`'´ʹ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  // Helper: Process subject scores with approved grades
  const processSubjectScores = useCallback((approvedGrades: ApprovedGradeItem[], subjects: SubjectListItem[]): SubjectScore[] => {
    // Subject codes to exclude from the report
    const excludedSubjectCodes = ['MWZ_A', 'NZF_A', 'SLK_A', 'MWZ_B', 'NZF_B', 'SLK_B'];
    
    // Create a map of approved grades by subject ID
    const gradesMap: Record<string, ApprovedGradeItem> = {};
    approvedGrades.forEach((grade) => {
      if (grade.subjectId) {
        gradesMap[grade.subjectId] = grade;
      }
    });

    // Process all subjects (with or without approved grades)
    const resultMap: Record<string, SubjectScore> = {};
    
    subjects.forEach((subject: SubjectListItem) => {
      const subjectId = subject.subjectId || subject.id;
      const subjectCode = subject.subject?.code || subject.code || '';
      
      // Skip excluded subject codes
      if (excludedSubjectCodes.includes(subjectCode)) {
        return;
      }
      
      const approved = subjectId ? gradesMap[subjectId] : undefined;
      
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
        rawScore = approved.score ? parseFloat(String(approved.score)) : 0;
      }
      
      const letterGrade = getLetterGrade(averageScore);
      
      const newSubject = {
        subject: subjectName,
        subjectCode: subjectCode,
        subjectArabicName: subjectArabicName,
        kkm: 0,  // KKM tidak ada di database, default 0
        scores: approved 
          ? [
              { type: 'DAILY', score: parseFloat(String(approved.dailyScore || 0)) },
              { type: 'MID', score: parseFloat(String(approved.midScore || 0)) },
              { type: 'FINAL', score: parseFloat(String(approved.finalScore || 0)) },
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
      const primaryKey = subjectCode || normalizeSubjectName(subjectName);
      const normalizedNameKey = normalizeSubjectName(subjectName);
      
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
        const codeA = a.subjectCode || '';
        const codeB = b.subjectCode || '';
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
      });
    
    return result;
  }, [getLetterGrade, getPredicate, normalizeSubjectName]);

  const fetchReportData = useCallback(async () => {
    if (!classId || !studentId) {
      return;
    }

    try {
      setError('');
      setIsLoading(true);

      const classResponse = await apiFetch(`/api/admin/classes/${classId}`);

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

      const studentResponse = await apiFetch(`/api/admin/classes/${classId}/students?limit=100`);

      let student: Student = {
        id: studentId,
        name: 'N/A',
        studentNo: 'N/A',
        birthDate: '',
        class: classObj.name || '-',
      };

      if (studentResponse.ok) {
        const studentData = await studentResponse.json();
        if (studentData.success && Array.isArray(studentData.data)) {
          const students = (studentData.data as Student[]).map((s) => ({
            id: s.id,
            name: s.name || 'N/A',
            studentNo: s.studentNo || 'N/A',
            birthDate: s.birthDate || '',
            class: classObj.name || '-',
          }));
          setAllStudents(students);

          const index = students.findIndex((s) => s.id === studentId);
          setCurrentStudentIndex(index >= 0 ? index : 0);

          const foundStudent = students.find((s) => s.id === studentId);
          if (foundStudent) {
            student = foundStudent;
          }
        }
      }

      let classSubjects: SubjectListItem[] = [];
      const classSubjectsResponse = await apiFetch(`/api/admin/classes/${classId}/subjects`);

      if (classSubjectsResponse.ok) {
        const classSubjectsData = await classSubjectsResponse.json();
        if (classSubjectsData.success && Array.isArray(classSubjectsData.data)) {
          classSubjects = classSubjectsData.data as SubjectListItem[];
        }
      }

      let masterSubjects: SubjectListItem[] = [];
      try {
        const subjectsResponse = await apiFetch(`/api/admin/subjects?levelId=${classObj.levelId}&limit=100`);

        if (subjectsResponse.ok) {
          const subjectsData = await subjectsResponse.json();
          if (subjectsData.success && Array.isArray(subjectsData.data)) {
            masterSubjects = subjectsData.data as SubjectListItem[];
          }
        }
      } catch {
      }

      let approvedGrades: ApprovedGradeItem[] = [];
      try {
        let approvedData: { success?: boolean; data?: unknown } | null = null;
        let apiUrl = `/api/wali-kelas/nilai-approve?studentId=${studentId}&classId=${classId}&limit=100`;
        if (assessmentType) {
          apiUrl += `&assessmentType=${assessmentType}`;
        }

        try {
          const approvedResponse = await apiFetch(apiUrl);

          if (approvedResponse.ok) {
            approvedData = await approvedResponse.json();
          }
        } catch {
        }

        if (!approvedData?.success) {
          let fallbackUrl = `/api/wali-kelas/grades-for-approval?classId=${classId}&studentId=${studentId}`;
          if (assessmentType) {
            fallbackUrl += `&assessmentType=${assessmentType}`;
          }

          const fallbackResponse = await apiFetch(fallbackUrl);

          if (fallbackResponse.ok) {
            approvedData = await fallbackResponse.json();
          }
        }

        const approvedPayload = approvedData?.data as {
          data?: ApprovedGradeItem[];
          grades?: ApprovedGradeItem[];
          subjectsByClass?: ApprovedGradeItem[];
        } | ApprovedGradeItem[] | undefined;

        if (Array.isArray(approvedPayload)) {
          approvedGrades = approvedPayload;
        } else if (approvedPayload?.data && Array.isArray(approvedPayload.data)) {
          approvedGrades = approvedPayload.data;
        } else if (approvedPayload?.grades && Array.isArray(approvedPayload.grades)) {
          approvedGrades = approvedPayload.grades;
        } else if (approvedPayload?.subjectsByClass && Array.isArray(approvedPayload.subjectsByClass)) {
          approvedGrades = approvedPayload.subjectsByClass;
        }

        if (assessmentType && approvedGrades.length > 0) {
          approvedGrades = approvedGrades.filter((grade) => grade.assessmentType === assessmentType);
        }
      } catch {
      }

      let subjectsToDisplay: SubjectListItem[] = [];
      if (masterSubjects.length > 0) {
        subjectsToDisplay = masterSubjects;
      } else if (classSubjects.length > 0) {
        subjectsToDisplay = classSubjects;
      } else if (approvedGrades.length > 0) {
        const subjectMap = new Map<string, SubjectListItem>();
        approvedGrades.forEach((grade) => {
          if (grade.subject && grade.subjectId && !subjectMap.has(grade.subjectId)) {
            subjectMap.set(grade.subjectId, {
              id: grade.subjectId,
              subject: grade.subject,
              subjectId: grade.subjectId,
            });
          }
        });
        subjectsToDisplay = Array.from(subjectMap.values());
      }

      const attendanceResponse = await apiFetch(`/api/teacher/students/${studentId}/attendance?classId=${classId}`);

      let attendance = { HADIR: 0, SAKIT: 0, IZIN: 0, ALFA: 0 };
      if (attendanceResponse.ok) {
        const attendanceData = await attendanceResponse.json();
        if (attendanceData.success && attendanceData.data?.summary) {
          attendance = attendanceData.data.summary;
        }
      }

      const subjectScores = processSubjectScores(approvedGrades, subjectsToDisplay);

      let mulahazoh = '';
      let nomorRaport = '';
      let suluk = '';
      let muazobah = '';
      let nazofah = '';

      if (approvedGrades.length > 0) {
        const firstGrade = approvedGrades[0];
        if (firstGrade.mulahazoh) mulahazoh = firstGrade.mulahazoh;
        if (firstGrade.nomorRaport) nomorRaport = firstGrade.nomorRaport;

        approvedGrades.forEach((grade) => {
          const subjectCode = grade.subjectCode || grade.subject?.code || '';
          if ((subjectCode === 'SLK_A' || subjectCode === 'SLK_B') && grade.score) {
            suluk = String(grade.score);
          } else if ((subjectCode === 'MWZ_A' || subjectCode === 'MWZ_B') && grade.score) {
            muazobah = String(grade.score);
          } else if ((subjectCode === 'NZF_A' || subjectCode === 'NZF_B') && grade.score) {
            nazofah = String(grade.score);
          }
        });
      }

      setReportData({
        student,
        subjectScores,
        attendance,
        semester: classObj?.semester?.number ? `Semester ${classObj.semester.number}` : 'Semester -',
        schoolYear: classObj?.schoolYear?.year || 'Tahun Ajaran -',
        school: {
          id: school.id || '',
          name: 'Kementerian Agama Republik Indonesia',
          address: school.address || '',
          phone: school.phone || '',
          email: school.email || '',
          principal: school.principal || '',
        },
        mulahazoh: mulahazoh || 'ضعيف جدًا',
        nomorRaport,
        suluk,
        muazobah,
        nazofah,
        semesterEndDate: classObj?.semester?.endDate,
      });
      setIsLoading(false);
    } catch (error) {
      devError('Error fetching report:', error);
      setError('Terjadi kesalahan saat memuat laporan');
      setIsLoading(false);
    }
  }, [assessmentType, classId, processSubjectScores, router, studentId]);

  useEffect(() => {
    void fetchReportData();
  }, [fetchReportData]);

  const handleViewCoverPreview = () => {
    router.push(
      `/wali-kelas/raport-arab/cover-preview?classId=${classId}&studentId=${studentId}`
    );
  };

  const handleDownloadPDF = async () => {
    try {
      if (!reportData) {
        alert('Data raport tidak tersedia');
        return;
      }

      const response = await apiFetch('/api/wali-kelas/generate-pdf-puppeteer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        devError('API Error:', errorData);
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
      devError('Error downloading PDF:', error);
      alert(`Gagal membuat PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDownloadAllPDF = async () => {
    try {
      if (!classId || !reportData) {
        alert('Data kelas tidak tersedia');
        return;
      }

      const response = await apiFetch('/api/wali-kelas/generate-pdf-all-students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classId,
          semester: reportData.semester,
          schoolYear: reportData.schoolYear,
          assessmentType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        devError('API Error:', errorData);
        throw new Error(errorData.error || 'Gagal membuat PDF semua siswa');
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
      devError('Error downloading all PDF:', error);
      alert(`Gagal membuat PDF semua: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handlePreviousStudent = () => {
    if (currentStudentIndex > 0) {
      const previousStudent = allStudents[currentStudentIndex - 1];
      const params = new URLSearchParams({
        classId: classId || '',
        studentId: previousStudent.id,
      });
      if (assessmentType) {
        params.append('assessmentType', assessmentType);
      }
      router.push(`/wali-kelas/raport-arab/detail?${params.toString()}`);
    }
  };

  const handleNextStudent = () => {
    if (currentStudentIndex < allStudents.length - 1) {
      const nextStudent = allStudents[currentStudentIndex + 1];
      const params = new URLSearchParams({
        classId: classId || '',
        studentId: nextStudent.id,
      });
      if (assessmentType) {
        params.append('assessmentType', assessmentType);
      }
      router.push(`/wali-kelas/raport-arab/detail?${params.toString()}`);
    }
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
          margin-top: 120px;
        }

        @media (max-width: 640px) {
          .a4-wrapper {
            padding: 20px 10px 10px 10px;
            margin-top: 150px;
          }
        }

        .a4-page {
          width: 210mm;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          padding: 6px 6px;
          font-size: 12px;
          line-height: 1.2;
          font-family: 'Amiri', 'Traditional Arabic', serif;
          direction: rtl;
          position: relative;
          overflow: auto;
          display: flex;
          flex-direction: column;
        }

        @media (max-width: 640px) {
          .a4-page {
            width: calc(100% - 4px);
            max-width: 100%;
            padding: 3px 2px;
            font-size: 11px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.1);
            overflow-x: auto;
            overflow-y: visible;
          }
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
          overflow-x: auto;
          overflow-y: hidden;
          flex-wrap: nowrap;
          scroll-behavior: smooth;
        }

        .toolbar::-webkit-scrollbar {
          height: 4px;
        }

        .toolbar::-webkit-scrollbar-track {
          background: #f0f0f0;
        }

        .toolbar::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 2px;
        }

        .toolbar::-webkit-scrollbar-thumb:hover {
          background: #999;
        }

        @media (max-width: 640px) {
          .toolbar {
            padding: 8px 12px;
            gap: 8px;
          }
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
            width: 210mm !important;
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
            width: 210mm !important;
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
            size: 210mm 330mm;
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

        @media (max-width: 640px) {
          table {
            font-size: 10px;
          }
          
          th, td {
            padding: 3px 2px;
          }
          
          thead th {
            padding: 4px 2px;
          }
          
          tbody td {
            padding: 2px 1px;
          }
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
        {/* Left Section: Back & Info */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-gray-700 hover:bg-gray-200 rounded transition-colors text-xs sm:text-sm font-medium"
            title="Kembali"
          >
            <ArrowLeft size={16} className="flex-shrink-0" />
            <span className="hidden sm:inline">Kembali</span>
          </button>
          
          <div className="hidden sm:inline-flex items-center gap-2">
            <div className="h-5 w-px bg-gray-300"></div>
            <div className="flex flex-col whitespace-nowrap">
              <span className="text-gray-600 text-xs font-medium">Raport Peserta Didik Bahasa Arab</span>
              {assessmentType && (
                <span className="text-emerald-600 text-xs font-semibold">
                  {assessmentTypeLabels[assessmentType] || assessmentType}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center Section: Navigation & Student Info */}
        <div className="flex items-center gap-1 sm:gap-2 flex-1 sm:justify-center px-2 sm:px-0">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={handlePreviousStudent}
              disabled={currentStudentIndex <= 0}
              className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded transition-colors text-xs sm:text-sm font-medium ${
                currentStudentIndex <= 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
              title="Siswa sebelumnya"
            >
              <span>←</span>
              <span className="hidden sm:inline">Prev</span>
            </button>

            <span className="text-gray-700 font-semibold px-1 sm:px-2 text-xs sm:text-sm whitespace-nowrap bg-gray-100 rounded">
              {currentStudentIndex >= 0 ? currentStudentIndex + 1 : 1}/{allStudents.length}
            </span>

            <button
              onClick={handleNextStudent}
              disabled={currentStudentIndex >= allStudents.length - 1}
              className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded transition-colors text-xs sm:text-sm font-medium ${
                currentStudentIndex >= allStudents.length - 1
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
              title="Siswa berikutnya"
            >
              <span className="hidden sm:inline">Next</span>
              <span>→</span>
            </button>

            <div className="hidden sm:inline-flex h-5 w-px bg-gray-300 mx-1"></div>

            <button
              onClick={handleViewCoverPreview}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-xs sm:text-sm font-medium"
              title="Lihat sampul raport"
            >
              <Eye size={14} className="flex-shrink-0" />
              <span className="hidden sm:inline">Cover</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs sm:text-sm font-medium"
              title="Download PDF"
            >
              <Download size={14} className="flex-shrink-0" />
              <span className="hidden sm:inline">PDF</span>
            </button>

            <button
              onClick={handleDownloadAllPDF}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium"
              title="Download PDF semua siswa"
            >
              <Download size={14} className="flex-shrink-0" />
              <span className="hidden sm:inline">PDF Semua</span>
            </button>
          </div>
        </div>
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
              <td className="center">{reportData.suluk ? toArabicNumerals(reportData.suluk) : '-'}</td>
              <td className="center">{reportData.suluk ? scoreToArabicText(parseFloat(reportData.suluk)) : '-'}</td>
              </tr>
              <tr>
              <th>المواظبة</th>
              <td className="center">{reportData.muazobah ? toArabicNumerals(reportData.muazobah) : '-'}</td>
              <td className="center">{reportData.muazobah ? scoreToArabicText(parseFloat(reportData.muazobah)) : '-'}</td>
              </tr>
              <tr>
              <th>النظافة</th>
              <td className="center">{reportData.nazofah ? toArabicNumerals(reportData.nazofah) : '-'}</td>
              <td className="center">{reportData.nazofah ? scoreToArabicText(parseFloat(reportData.nazofah)) : '-'}</td>
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
                تقرير بدار السلام لاهات، {formatDateToArabic(reportData?.semesterEndDate)}
              </div>
              </td>

              {/* Kolom tengah (pimpinan + nama) */}
              <td style={{ width: '34%', textAlign: 'center', padding: '8px', fontSize: '12px', fontFamily: "'Amiri', 'Traditional Arabic', serif", verticalAlign: 'top', border: 'none' }}>
              <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
              مدير المعهد دار السلام لاهات
              </div>
              
              <div style={{ margin: '5px auto', textAlign: 'center', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
                <img src="/ttd.png" alt="TTD" style={{ width: '200px', height: 'auto' }} />
              </div>
              
              <div style={{ borderTop: '1px solid #000', marginTop: '5px', paddingTop: '8px' }}></div>
              <div style={{ marginTop: '2px', fontSize: '12px' }}>
              الأستاذ محمد رومي أوكتاريوس، LC
              </div>
              </td>

              {/* Kolom kiri (catatan + nilai) */}
              <td style={{ width: '33%', textAlign: 'center', padding: '8px', fontSize: '12px', fontFamily: "'Amiri', 'Traditional Arabic', serif", verticalAlign: 'top', border: 'none' }}>
              
              <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
              الملاحظة
              </div>
              <div style={{ fontSize: '14px', marginBottom: '12px', fontWeight: 'bold' }}>
              {reportData.mulahazoh || 'ضعيف جدًا'}
              </div>
                <div style={{ fontSize: '10px', marginTop: '40px', paddingTop: '8px', borderTop: '1px solid #ccc', fontWeight: 'bold' }}>
                SERIAL: {reportData.nomorRaport || '-'}
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
