'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Download, Eye } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  studentNo: string;
  raportNo?: string;
  gender?: string;
}

interface ClassData {
  id: string;
  name: string;
}

function CoverPreviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = searchParams.get('classId');
  const studentId = searchParams.get('studentId');
  const assessmentType = searchParams.get('assessmentType');

  const [student, setStudent] = useState<Student | null>(null);
  const [classData, setClassData] = useState<ClassData | null>(null);
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
        const token = localStorage.getItem('accessToken');
        if (!token) {
          setError('Sesi Anda telah berakhir');
          return;
        }

        // Fetch class data
        const classResponse = await fetch(`/api/admin/classes/${classId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (classResponse.ok) {
          const classDataJson = await classResponse.json();
          if (classDataJson.success) {
            setClassData({
              id: classDataJson.data.id,
              name: classDataJson.data.name || 'N/A',
            });
          }
        }

        // Fetch student data with raport number
        const studentResponse = await fetch(`/api/admin/classes/${classId}/students?limit=1000`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (studentResponse.ok) {
          const studentData = await studentResponse.json();
          if (studentData.success && Array.isArray(studentData.data)) {
            const students = studentData.data.map((s: any) => ({
              id: s.id,
              name: s.name || 'N/A',
              studentNo: s.studentNo || 'N/A',
              raportNo: s.raportNo || null,
              gender: s.gender || 'MALE',
            }));
            setAllStudents(students);

            const foundIndex = students.findIndex((s: any) => s.id === studentId);
            if (foundIndex !== -1) {
              setStudent(students[foundIndex]);
              setCurrentStudentIndex(foundIndex);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching student:', err);
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
      router.push(`/admin/raport-arab/cover-preview?${params.toString()}`);
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
      router.push(`/admin/raport-arab/cover-preview?${params.toString()}`);
    }
  };

  const handleViewDetail = () => {
    const params = new URLSearchParams({
      classId: classId || '',
      studentId: studentId || '',
    });
    if (assessmentType) {
      params.append('assessmentType', assessmentType);
    }
    router.push(`/admin/raport-arab/detail?${params.toString()}`);
  };

  const handleSeeAllStudents = () => {
    router.push('/admin/raport-sampul');
  };

  const handleGeneratePDF = async () => {
    try {
      if (!student || !classData) {
        alert('Data siswa atau kelas tidak tersedia');
        return;
      }

      const coverElement = document.querySelector('.cover-page');
      if (!coverElement) {
        alert('Elemen cover tidak ditemukan');
        return;
      }

      const response = await fetch('/api/wali-kelas/generate-cover-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          studentName: student.name,
          className: classData.name,
          studentNo: student.studentNo,
          raportNo: student.raportNo,
          gender: student.gender,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal membuat PDF cover');
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
      console.error('Error generating cover PDF:', error);
      alert(`Gagal membuat PDF cover: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          font-size: 11px;
          line-height: 1.2;
          direction: rtl;
          position: relative;
          overflow: auto;
          font-family: 'Amiri', 'Traditional Arabic', 'Arial Unicode MS', serif;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
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
          margin-bottom: 8mm;
          padding-bottom: 8px;
        }

        .cover-institution-main {
          font-size: 26px;
          font-weight: bold;
          color: #1a1a1a;
          margin-bottom: 8px;
          line-height: 1.4;
        }

        .cover-institution-sub {
          font-size: 16px;
          color: #333;
          margin-bottom: 6px;
          font-weight: 500;
        }

        .cover-institution-location {
          font-size: 11px;
          color: #666;
          margin-bottom: 0;
        }

        .cover-logo-section {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 8px;
          margin-bottom: 10mm;
          width: 100%;
        }

        .cover-logo-section img {
          max-width: 90px;
          height: auto;
          object-fit: contain;
        }

        .cover-title-section {
          text-align: center;
          margin: 10mm 0 8mm 0;
        }

        .cover-title-image {
          max-width: 180px;
          height: auto;
          object-fit: contain;
          margin-bottom: 6px;
        }

        .cover-semester-info {
          text-align: center;
          font-size: 12px;
          color: #555;
          margin-bottom: 4px;
          line-height: 1.2;
        }

        .cover-year-info {
          text-align: center;
          font-size: 11px;
          color: #666;
          margin-bottom: 10mm;
        }

        .cover-student-info {
          background: white;
          padding: 15px 20px;
          width: 100%;
          font-size: 13px;
          margin: 0 auto 15mm auto;
          max-width: 100%;
        }

        .cover-info-row {
          display: flex;
          justify-content: flex-start;
          align-items: center;
          margin: 10px 0;
          padding: 8px 0;
          border-bottom: 1px solid #ddd;
        }

        .cover-info-row:last-child {
          border-bottom: none;
        }

        .cover-info-label {
          font-weight: bold;
          text-align: right;
          flex: 0 0 35%;
          padding-right: 15px;
          color: #1a1a1a;
          font-size: 13px;
        }

        .cover-info-value {
          text-align: left;
          flex: 1;
          font-weight: 500;
          color: #333;
          font-size: 13px;
        }

        .cover-serial-section {
          text-align: center;
          margin-top: auto;
          padding-top: 5mm;
        }

        .cover-serial-box {
          border: 1px solid #333;
          display: inline-block;
          padding: 6px 16px;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          font-weight: bold;
          color: #333;
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
            <span className="text-blue-700 text-xs font-semibold">
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

        <div className="hidden md:block h-6 w-px bg-gray-300 ml-4"></div>

        <button
          onClick={handleViewDetail}
          className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1 md:py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 md:ml-4 text-sm md:text-base whitespace-nowrap"
          title="Lihat detail raport"
        >
          <Eye size={18} className="md:w-5 md:h-5" />
          <span className="hidden md:inline">Detail</span>
        </button>

        <button
          onClick={handleGeneratePDF}
          className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1 md:py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm md:text-base whitespace-nowrap"
          title="Download cover sebagai PDF"
        >
          <Download size={18} className="md:w-5 md:h-5" />
          <span className="hidden md:inline">PDF</span>
        </button>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1 md:py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm md:text-base whitespace-nowrap"
        >
          <Printer size={18} className="md:w-5 md:h-5" />
          <span className="hidden md:inline">Cetak</span>
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
                />
                <img src="/mahad.png" alt="Mahad Logo" />
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
                <div className="cover-semester-info">للفصل الدراسي الثاني</div>
                <div className="cover-year-info">
                  <div>عام ٢٠٢٥-٢٠٢٤ | ١٤٤٦ – ١٤٤٥</div>
                </div>
              </div>

              {/* Student Information */}
              <div className="cover-student-info">
                <div className="cover-info-row">
                  <span className="cover-info-value"><strong>{student.name}</strong></span>
                  <span className="cover-info-label">اسم الطالب</span>
                </div>
                <div className="cover-info-row">
                  <span className="cover-info-value"><strong>{classData?.name || 'الفصل الأول'}</strong></span>
                  <span className="cover-info-label">الفصل</span>
                </div>
                <div className="cover-info-row">
                  <span className="cover-info-value"><strong>{student.studentNo}</strong></span>
                  <span className="cover-info-label">رقم دفتر القيد</span>
                </div>
                <div className="cover-info-row">
                  <span className="cover-info-value"><strong>LAHAT</strong></span>
                  <span className="cover-info-label">البرنامج</span>
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

export default function AdminCoverPreviewPage() {
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
