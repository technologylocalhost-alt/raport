'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Download } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  studentNo: string;
}

function CoverPreviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = searchParams.get('classId');
  const studentId = searchParams.get('studentId');

  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          setError('Sesi Anda telah berakhir');
          return;
        }

        // Fetch student data
        const studentResponse = await fetch(`/api/admin/classes/${classId}/students?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (studentResponse.ok) {
          const studentData = await studentResponse.json();
          if (studentData.success && Array.isArray(studentData.data)) {
            const found = studentData.data.find((s: any) => s.id === studentId);
            if (found) {
              setStudent({
                id: found.id,
                name: found.name || 'N/A',
                studentNo: found.studentNo || 'N/A',
              });
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

  const getCurrentDateArabic = () => {
    const now = new Date();
    return now.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 p-6">
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
        }

        .cover-page {
          width: 215mm;
          height: 330mm;
          background: white;
          font-size: 11px;
          line-height: 1.2;
          direction: rtl;
          position: relative;
          overflow: hidden;
          font-family: 'Amiri', 'Traditional Arabic', 'Arial Unicode MS', serif;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
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
      `}</style>

      <div className="max-w-7xl mx-auto w-full">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-8 bg-white p-4 rounded-lg shadow-md">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Preview Sampul Raport</h2>
            <p className="text-sm text-gray-600">Siswa: {student.name}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Printer size={18} />
              Print
            </button>
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors"
            >
              <ArrowLeft size={18} />
              Kembali
            </button>
          </div>
        </div>

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
                <img src="/KMI.jpg" alt="KMI Logo" />
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
                  <span className="cover-info-value"><strong>الفصل الأول</strong></span>
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
                <div className="cover-serial-box">UAS-SMT-2-24/25-PA-1</div>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow-md max-w-4xl mx-auto">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">💡 Catatan Preview</h3>
          <ul className="space-y-2 text-gray-700 text-sm">
            <li>• Ini adalah tampilan preview sampul (cover page) raport</li>
            <li>• Saat download PDF, sampul ini akan disertakan sebagai halaman pertama</li>
            <li>• Logo institusi akan ditampilkan saat data tersedia di sistem</li>
            <li>• Gunakan tombol "Print" untuk mencetak preview ini dengan kualitas tinggi</li>
            <li>• Tampilan di printer akan lebih presisi dari preview layar</li>
          </ul>
        </div>
      </div>

      <style>{`
        @media print {
          body {
            background: white;
          }
          .max-w-7xl > div:nth-child(1),
          .max-w-7xl > div:nth-child(3) {
            display: none;
          }
          .a4-wrapper {
            padding: 0;
            background: white;
            min-height: 100vh;
          }
        }
      `}</style>
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
