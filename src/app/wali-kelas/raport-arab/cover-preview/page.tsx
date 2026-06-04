/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { devError } from '@/lib/dev-log';

interface Student {
  id: string;
  name: string;
  studentNo: string;
  raportNo?: string | null;
  gender?: string;
}

interface ClassData {
  id: string;
  name: string;
  semesterId?: string;
  schoolYearId?: string;
}

interface SemesterData {
  id: string;
  number: number;
  semesterLabel?: string;
  semesterLabelArabic?: string;
  schoolYearId: string;
}

interface SchoolYearData {
  id: string;
  year: string;
  tahunAkademik?: string;
  tahunAkademikArabic?: string;
}

interface StudentApiItem {
  id: string;
  name?: string;
  studentNo?: string;
  raportNo?: string | null;
  gender?: string;
}

function CoverPreviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = searchParams.get('classId');
  const studentId = searchParams.get('studentId');
  const assessmentType = searchParams.get('assessmentType');

  const [student, setStudent] = useState<Student | null>(null);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [semesterData, setSemesterData] = useState<SemesterData | null>(null);
  const [schoolYearData, setSchoolYearData] = useState<SchoolYearData | null>(null);
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch class data
        const classResponse = await apiFetch(`/api/admin/classes/${classId}`);

        if (classResponse.ok) {
          const classDataJson = await classResponse.json();
          if (classDataJson.success) {
            const classDataResult = {
              id: classDataJson.data.id,
              name: classDataJson.data.name || 'N/A',
              semesterId: classDataJson.data.semesterId,
              schoolYearId: classDataJson.data.schoolYearId,
            };
            setClassData(classDataResult);
            
            // Fetch semester data if semesterId exists
            if (classDataJson.data.semesterId) {
              try {
                const semesterResponse = await apiFetch(`/api/admin/semesters/${classDataJson.data.semesterId}`);
                if (semesterResponse.ok) {
                  const semesterDataJson = await semesterResponse.json();
                  if (semesterDataJson.success) {
                    setSemesterData(semesterDataJson.data);
                  }
                } else {
                }
              } catch (semErr) {
                devError('Error fetching semester:', semErr);
              }
            }
            
            // Fetch school year data if schoolYearId exists
            if (classDataJson.data.schoolYearId) {
              try {
                const schoolYearResponse = await apiFetch(`/api/admin/school-years/${classDataJson.data.schoolYearId}`);
                if (schoolYearResponse.ok) {
                  const schoolYearDataJson = await schoolYearResponse.json();
                  if (schoolYearDataJson.success) {
                    setSchoolYearData(schoolYearDataJson.data);
                  }
                } else {
                }
              } catch (syErr) {
                devError('Error fetching school year:', syErr);
              }
            }
          }
        }

        // Fetch student data with raport number
        const studentResponse = await apiFetch(`/api/admin/classes/${classId}/students?limit=1000`);

        if (studentResponse.ok) {
          const studentData = await studentResponse.json();
          if (studentData.success && Array.isArray(studentData.data)) {
            const students = (studentData.data as StudentApiItem[]).map((s) => ({
              id: s.id,
              name: s.name || 'N/A',
              studentNo: s.studentNo || 'N/A',
              raportNo: s.raportNo || null,
              gender: s.gender || 'MALE',
            }));
            setAllStudents(students);
            
            const foundIndex = students.findIndex((s) => s.id === studentId);
            if (foundIndex !== -1) {
              setStudent(students[foundIndex]);
              setCurrentStudentIndex(foundIndex);
            }
          }
        }
      } catch (error) {
        devError('Error fetching student:', error);
        setError('Gagal memuat data siswa');
      } finally {
        setIsLoading(false);
      }
    };

    if (classId && studentId) {
      fetchData();
    }
  }, [classId, studentId]);

  const handlePreviousStudent = () => {
    if (currentStudentIndex > 0) {
      const prevStudent = allStudents[currentStudentIndex - 1];
      const params = new URLSearchParams({
        classId: classId || '',
        studentId: prevStudent.id,
      });
      if (assessmentType) {
        params.append('assessmentType', assessmentType);
      }
      router.push(`/wali-kelas/raport-arab/cover-preview?${params.toString()}`);
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
      router.push(`/wali-kelas/raport-arab/cover-preview?${params.toString()}`);
    }
  };

  const handleSeeAllStudents = () => {
    const params = new URLSearchParams();
    if (classId) {
      params.append('classId', classId);
    }
    if (assessmentType) {
      params.append('assessmentType', assessmentType);
    }
    const queryString = params.toString();
    router.push(`/wali-kelas/raport-arab${queryString ? '?' + queryString : ''}`);
  };

  const handleGeneratePDF = async () => {
    try {
      if (!student || !classData) {
        alert('Data siswa atau kelas tidak tersedia');
        return;
      }

      const response = await apiFetch('/api/wali-kelas/generate-cover-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentName: student.name,
          className: classData.name,
          studentNo: student.studentNo,
          raportNo: student.raportNo,
          gender: student.gender,
          semesterLabel: semesterData?.semesterLabelArabic || 'للفصل الدراسي الثاني',
          schoolYear: schoolYearData?.tahunAkademikArabic || 'عام ٢٠٢٥-٢٠٢٤',
          schoolYearGregorian: schoolYearData?.year || '',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        devError('[handleGeneratePDF] Error response:', errorData);
        throw new Error(errorData.error || 'Gagal membuat PDF cover');
      }

      const result = await response.json();
      
      if (!result.pdf) {
        throw new Error('PDF data tidak diterima dari server');
      }

      // Download PDF
      const link = document.createElement('a');
      link.href = result.pdf;
      link.download = result.fileName || 'cover.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      devError('Error generating cover PDF:', error);
      alert(`Gagal membuat PDF cover: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDownloadAllCovers = async () => {
    try {
      if (!classId || !classData) {
        alert('Data kelas tidak lengkap');
        return;
      }

      const response = await apiFetch('/api/wali-kelas/generate-cover-pdf-all-students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classId,
          className: classData.name,
          semesterLabel: semesterData?.semesterLabelArabic || 'للفصل الدراسي الثاني',
          schoolYear: schoolYearData?.tahunAkademikArabic || 'عام ٢٠٢٥-٢٠٢٤',
          schoolYearGregorian: schoolYearData?.year || '',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal membuat PDF cover untuk semua siswa');
      }

      const result = await response.json();

      if (!result.pdf) {
        throw new Error('PDF data tidak diterima dari server');
      }

      // Download PDF
      const link = document.createElement('a');
      link.href = result.pdf;
      link.download = result.fileName || 'cover-semua.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      devError('Error downloading all covers:', error);
      alert(`Gagal download cover semua siswa: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Memuat preview...</p>
      </div>
    );
  }

  if (error || !student) {
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .a4-wrapper {
          background: #f5f5f5;
          padding: 40px 20px 20px 20px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          width: 100%;
          margin-top: 120px;
        }

        @media (max-width: 640px) {
          .a4-wrapper {
            padding: 20px 10px 10px 10px;
            margin-top: 140px;
          }
        }

        .cover-page {
          width: 215mm;
          height: 330mm;
          background: white;
          font-size: 13px;
          line-height: 1.3;
          direction: rtl;
          position: relative;
          overflow: hidden;
          font-family: 'Amiri', 'Traditional Arabic', 'Arial Unicode MS', serif;
          box-shadow: 0 4px 12px rgba(0,0,0,0.12);
        }

        @media (max-width: 640px) {
          .cover-page {
            width: calc(100% - 8px);
            max-width: 100%;
            height: auto;
            font-size: 10px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.1);
          }
        }

        .cover-frame {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 215mm;
          height: 330mm;
          z-index: 0;
          pointer-events: none;
        }

        .cover-frame img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .cover-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 20mm 15mm;
          box-sizing: border-box;
        }

        .cover-header-section {
          text-align: center;
          margin-bottom: 6mm;
          padding-bottom: 0;
        }

        .cover-institution-main {
          font-size: 18px;
          font-weight: bold;
          color: #1a1a1a;
          margin-bottom: 6px;
          line-height: 1.3;
          direction: rtl;
        }

        .cover-institution-sub {
          font-size: 13px;
          color: #333;
          margin-bottom: 4px;
          font-weight: 500;
          direction: rtl;
        }

        .cover-institution-location {
          font-size: 24px;
          color: #1b025b;
          margin-bottom: 0;
          direction: rtl;
          font-weight: 700;
        }

        .cover-logo-section {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 12px;
          margin-bottom: 10mm;
          width: 100%;
        }

        .cover-logo-kmi {
          max-width: 600px;
          height: auto;
          object-fit: contain;
          margin-top: 14mm;
        }

        .cover-logo-kmi-putri {
          max-width: 450px;
          height: auto;
          object-fit: contain;
          margin-top: 14mm;
        }

        .cover-logo-mahad {
          max-width: 380px;
          height: auto;
          object-fit: contain;
          margin-top: 0mm;
        }

        .cover-title-section {
          text-align: center;
          margin: 6mm 0 12mm 0;
        }

        .cover-title-image {
          max-width: 400px;
          height: auto;
          object-fit: contain;
          margin-bottom: 46px;

        }

        .cover-semester-info {
          text-align: center;
          font-size: 18px;
          color: #000000;
          margin-bottom: 15px;
          line-height: 1.3;
          font-weight: 700;
          direction: rtl;
        }

        .cover-year-info {
          text-align: center;
          font-size: 16px;
          color: #000000;
          margin-bottom: 16mm;
          line-height: 1.4;
          direction: rtl;
          font-weight: 600;
        }

        .cover-student-info {
          background: transparent;
          padding: 0;
          width: 100%;
          font-family: 'Times New Roman', serif;
          margin: 0 auto 8mm auto;
          max-width: 100%;
          border-collapse: collapse;
          direction: ltr;
          display: grid;
          grid-template-columns: auto 50px auto;
          align-items: center;
          justify-items: center;
          gap: 0;
        }

        .cover-info-row {
          display: contents;
        }

        .cover-info-label {
          font-weight: bold;
          text-align: right;
          color: #333;
          font-size: 22px;
          padding: 10px;
          direction: rtl;
          justify-self: end;
        }

        .cover-info-value {
          text-align: right;
          font-weight: bold;
          color: #1a1a1a;
          font-size: 22px;
          padding: 10px;
          justify-self: end;
        }

        .cover-separator {
          text-align: center;
          font-weight: 400;
          color: #333;
          font-size: 22px;
          padding: 10px;
          width: 100%;
          direction: ltr;
          justify-self: center;
        }

        .cover-serial-section {
          text-align: center;
          margin-top: auto;
          padding-top: 8mm;
        }

        .cover-serial-box {
          border: 2px solid #333;
          display: inline-block;
          padding: 8px 18px;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          font-weight: 600;
          color: #1a1a1a;
          background: #fafafa;
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

        body {
          padding-top: 60px;
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

          .cover-page {
            box-shadow: none !important;
            page-break-after: avoid !important;
          }
        }
      `}</style>

      <div className="toolbar">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1 md:py-2 text-gray-700 hover:bg-gray-300 rounded text-sm md:text-base whitespace-nowrap"
        >
          <ArrowLeft size={18} className="md:w-5 md:h-5" />
          <span className="hidden md:inline">Kembali</span>
        </button>
        <div className="hidden md:block h-6 w-px bg-gray-300"></div>
        <div className="hidden md:flex flex-col">
          <span className="text-gray-600 text-sm">Sampul Raport Bahasa Arab - F4 (215 × 330 mm)</span>
          {assessmentType && (
            <span className="text-emerald-700 text-xs font-semibold">
              Jenis Penilaian: {assessmentTypeLabels[assessmentType] || assessmentType}
            </span>
          )}
        </div>
        
        {/* Navigation Buttons */}
        <div className="ml-auto flex items-center gap-1 md:gap-2 flex-nowrap">
          <button
            onClick={handlePreviousStudent}
            disabled={currentStudentIndex <= 0}
            className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1 md:py-2 rounded text-sm md:text-base whitespace-nowrap ${
              currentStudentIndex <= 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gray-400 text-white hover:bg-gray-500'
            }`}
          >
            <span className="hidden md:inline">←</span>
            <span className="hidden md:inline">Sebelumnya</span>
            <span className="md:hidden text-xs">‹</span>
          </button>
          
          <button
            onClick={handleSeeAllStudents}
            className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1 md:py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm md:text-base whitespace-nowrap"
          >
            <span className="hidden md:inline">Lihat Semua</span>
            <span className="md:hidden text-xs">Semua</span>
          </button>
          
          <button
            onClick={handleNextStudent}
            disabled={currentStudentIndex >= allStudents.length - 1}
            className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1 md:py-2 rounded text-sm md:text-base whitespace-nowrap ${
              currentStudentIndex >= allStudents.length - 1
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gray-400 text-white hover:bg-gray-500'
            }`}
          >
            <span className="hidden md:inline">Berikutnya</span>
            <span className="md:hidden text-xs">›</span>
            <span className="hidden md:inline">→</span>
          </button>

          <span className="text-gray-700 font-medium px-2 md:px-4 ml-1 md:ml-4 text-xs md:text-base whitespace-nowrap">
            {currentStudentIndex >= 0 ? currentStudentIndex + 1 : 1}/{allStudents.length}
          </span>
        </div>


        <button
          onClick={handleGeneratePDF}
          className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1 md:py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm md:text-base whitespace-nowrap"
          title="Download cover sebagai PDF"
        >
          <Download size={18} className="md:w-5 md:h-5" />
          <span className="hidden md:inline">PDF</span>
        </button>

        <button
          onClick={handleDownloadAllCovers}
          className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1 md:py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm md:text-base whitespace-nowrap"
          title="Download cover semua siswa sebagai PDF"
        >
          <Download size={18} className="md:w-5 md:h-5" />
          <span className="hidden md:inline">PDF Semua</span>
        </button>
        

      </div>

      <div className="w-full" style={{ paddingTop: '20px' }}>

        {/* Cover Page Preview */}
        <div className="a4-wrapper">
          <div className="cover-page">
            {/* Frame Background */}
            <div className="cover-frame">
              <img src="/bingkai.png" alt="Frame" />
            </div>

            {/* Cover Content */}
            <div className="cover-content">
              {/* Logo Section */}
              <div className="cover-logo-section">
                <img 
                  src={student?.gender === 'FEMALE' ? '/kmi_putri.png' : '/KMI.jpg'} 
                  alt="KMI Logo" 
                  className={student?.gender === 'FEMALE' ? 'cover-logo-kmi-putri' : 'cover-logo-kmi'} 
                />
                <img src="/mahad.png" alt="Mahad Logo" className="cover-logo-mahad" />
              </div>

              {/* Institution Header */}
              <div className="cover-header-section">
                <div className="cover-institution-location">لاهات – سومطرة الجنوبية – اندونيسيا</div>
              </div>

              {/* Title Section */}
              <div className="cover-title-section">
                <div className="flex justify-center">
                  <img src="/kasyfu.jpg" alt="Kasyfu Title" className="cover-title-image" />
                </div>
                <div className="cover-semester-info">
                  {semesterData?.semesterLabelArabic || 'للفصل الدراسي الثاني'}
                </div>
                <div className="cover-year-info">
                  <div>{schoolYearData?.tahunAkademikArabic || 'عام ٢٠٢٥-٢٠٢٤'} {schoolYearData?.year ? `| ${schoolYearData.year}` : '| ١٤٤٦ – ١٤٤٥'}</div>
                </div>
              </div>

              {/* Student Information */}
              <div className="cover-student-info">
                <div className="cover-info-row">
                  <span className="cover-info-value"><strong>{student.name}</strong></span>
                  <span className="cover-separator">:</span>
                  <span className="cover-info-label">اسم الطالب</span>
                </div>
                <div className="cover-info-row">
                  <span className="cover-info-value"><strong>{classData?.name || 'الفصل الأول'}</strong></span>
                  <span className="cover-separator">:</span>
                  <span className="cover-info-label">الفصل</span>
                </div>
                <div className="cover-info-row">
                  <span className="cover-info-value"><strong>{student.studentNo}</strong></span>
                  <span className="cover-separator">:</span>
                  <span className="cover-info-label">رقم دفتر القيد</span>
                </div>
                <div className="cover-info-row">
                  <span className="cover-info-value"><strong>LAHAT</strong></span>
                  <span className="cover-separator">:</span>
                  <span className="cover-info-label">الدائرة</span>
                </div>
              </div>

              {/* Serial Number */}
              <div className="cover-serial-section">
                <div className="cover-serial-box">{student.raportNo || '-'}</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function CoverPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-600">Memuat...</p>
        </div>
      }
    >
      <CoverPreviewContent />
    </Suspense>
  );
}
