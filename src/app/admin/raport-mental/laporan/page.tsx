'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Download, Printer } from 'lucide-react';

interface School {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface NilaiItem {
  nilai: string | null;
  dataEkstra: string | null;
  aspek: {
    id: string;
    nama: string;
    urutan: number;
    punyaFieldData: boolean;
    fieldDataType?: 'NONE' | 'TEXT' | 'PRESTASI' | 'HUKUMAN';
  };
}

interface Seksi {
  id: string;
  nama: string;
  kode: string;
  urutan: number;
  tipeNilai: 'NILAI_ABCD' | 'NILAI_ABCDE' | 'NILAI_PLUS_MINUS' | 'TEXT' | 'ANGKA';
  aspek: {
    id: string;
    nama: string;
    urutan: number;
    punyaFieldData: boolean;
    fieldDataType?: 'NONE' | 'TEXT' | 'PRESTASI' | 'HUKUMAN';
  }[];
}

interface PrestasiData {
  bidangDivisi: string;
  juara: string;
}

interface HukumanRow {
  namaPelanggaran: string;
  hukuman: string;
  jumlah: string;
}

function parsePrestasiData(raw?: string | null): PrestasiData {
  if (!raw) return { bidangDivisi: '', juara: '' };
  try {
    const parsed = JSON.parse(raw);
    return {
      bidangDivisi: typeof parsed.bidangDivisi === 'string' ? parsed.bidangDivisi : '',
      juara: typeof parsed.juara === 'string' ? parsed.juara : '',
    };
  } catch {
    return { bidangDivisi: '', juara: '' };
  }
}

function parseHukumanRows(raw?: string | null): HukumanRow[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        namaPelanggaran: typeof item?.namaPelanggaran === 'string'
          ? item.namaPelanggaran
          : (typeof item?.jenisHukuman === 'string' ? item.jenisHukuman : ''),
        hukuman: typeof item?.hukuman === 'string' ? item.hukuman : '',
        jumlah: typeof item?.jumlah === 'string' ? item.jumlah : '',
      })).filter((row) => row.namaPelanggaran || row.hukuman || row.jumlah);
    }

    return [{
      namaPelanggaran: typeof parsed.namaPelanggaran === 'string'
        ? parsed.namaPelanggaran
        : (typeof parsed.jenisHukuman === 'string' ? parsed.jenisHukuman : ''),
      hukuman: typeof parsed.hukuman === 'string' ? parsed.hukuman : '',
      jumlah: typeof parsed.jumlah === 'string' ? parsed.jumlah : '',
    }].filter((row) => row.namaPelanggaran || row.hukuman || row.jumlah);
  } catch {
    return [];
  }
}

function nilaiDisplay(item?: NilaiItem): string {
  return item?.nilai?.trim() || '-';
}

function MentalReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const studentNo = searchParams.get('studentNo') || '';
  const studentName = searchParams.get('studentName') || '';
  const className = searchParams.get('className') || '';
  const schoolId = searchParams.get('schoolId') || '';
  const schoolYearId = searchParams.get('schoolYearId') || '';
  const semesterId = searchParams.get('semesterId') || '';
  const schoolYearLabel = searchParams.get('schoolYearLabel') || '';
  const semesterLabel = searchParams.get('semesterLabel') || '';

  const [school, setSchool] = useState<School | null>(null);
  const [seksiList, setSeksiList] = useState<Seksi[]>([]);
  const [nilaiList, setNilaiList] = useState<NilaiItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setError('Sesi login tidak ditemukan');
      setIsLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    const fetchData = async () => {
      try {
        const [schoolRes, seksiRes, nilaiRes] = await Promise.all([
          fetch('/api/admin/schools?limit=100', { headers }),
          fetch('/api/admin/raport-mental/seksi', { headers }),
          fetch(`/api/admin/raport-mental/nilai?studentNo=${studentNo}&schoolYearId=${schoolYearId}&semesterId=${semesterId}`, { headers }),
        ]);

        const [schoolJson, seksiJson, nilaiJson] = await Promise.all([
          schoolRes.json(),
          seksiRes.json(),
          nilaiRes.json(),
        ]);

        if (schoolJson.success) {
          const schools: School[] = Array.isArray(schoolJson.data)
            ? schoolJson.data
            : (schoolJson.data?.data ?? []);
          setSchool(schools.find((item) => item.id === schoolId) ?? null);
        }

        if (!seksiJson.success) {
          setError(seksiJson.error || 'Gagal memuat master data raport mental');
          return;
        }

        if (!nilaiJson.success) {
          setError(nilaiJson.error || 'Gagal memuat nilai raport mental');
          return;
        }

        setSeksiList(Array.isArray(seksiJson.data) ? seksiJson.data : []);
        setNilaiList(Array.isArray(nilaiJson.data) ? nilaiJson.data : []);
      } catch {
        setError('Gagal memuat laporan raport mental');
      } finally {
        setIsLoading(false);
      }
    };

    if (!studentNo || !schoolYearId || !semesterId) {
      setError('Parameter laporan tidak lengkap');
      setIsLoading(false);
      return;
    }

    fetchData();
  }, [schoolId, schoolYearId, semesterId, studentNo]);

  const nilaiMap = useMemo(
    () => new Map(nilaiList.map((item) => [item.aspek.id, item])),
    [nilaiList]
  );

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    const reportElement = document.querySelector('.report-root');
    if (!reportElement) {
      alert('Area laporan tidak ditemukan');
      return;
    }

    try {
      setIsDownloadingPdf(true);

      const styleTags = Array.from(document.querySelectorAll('style'))
        .map((tag) => tag.innerHTML)
        .join('\n');

      const html = `<!DOCTYPE html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Laporan Raport Mental</title>
    <style>${styleTags}</style>
  </head>
  <body>
    ${reportElement.outerHTML}
  </body>
</html>`;

      const response = await fetch('/api/admin/raport-mental/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}`,
        },
        body: JSON.stringify({
          html,
          fileName: `raport-mental-${studentName || studentNo || 'santri'}.pdf`,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal membuat PDF');
      }

      const link = document.createElement('a');
      link.href = result.pdf;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert(`Gagal membuat PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-600">Memuat laporan raport mental...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <button onClick={() => router.back()} className="mt-4 text-emerald-600 hover:text-emerald-700">
            ← Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          background: #f3f4f6;
          font-family: 'Times New Roman', Times, serif;
        }

        .toolbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          border-bottom: 1px solid #d1d5db;
          background: #f9fafb;
        }

        .page-wrap {
          min-height: 100vh;
          padding: 72px 20px 24px;
          display: flex;
          justify-content: center;
        }

        .page {
          width: 210mm;
          min-height: 297mm;
          background: white;
          padding: 12mm;
          box-shadow: 0 0 20px rgba(0, 0, 0, 0.12);
          color: #111827;
        }

        .report-meta {
          margin-bottom: 10px;
          font-size: 11pt;
          line-height: 1.6;
        }

        .report-meta-row {
          display: grid;
          grid-template-columns: 120px 12px 1fr;
        }

        .section-title {
          margin: 14px 0 6px;
          font-size: 12pt;
          font-weight: bold;
          text-transform: uppercase;
        }

        .mental-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 10px;
          font-size: 10pt;
        }

        .mental-table th,
        .mental-table td {
          border: 1px solid #111827;
          padding: 5px 6px;
          vertical-align: top;
        }

        .mental-table th {
          background: #e5e7eb;
          text-align: center;
          font-weight: bold;
        }

        .center {
          text-align: center;
        }

        .note-box {
          margin-top: 12px;
          border: 1px solid #111827;
          padding: 10px;
          min-height: 84px;
          font-size: 10pt;
        }

        .signature-grid {
          margin-top: 20px;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 24px;
          font-size: 10pt;
          text-align: center;
        }

        .signature-name {
          margin-top: 60px;
          font-weight: bold;
          text-decoration: underline;
        }

        @media print {
          html, body {
            background: white !important;
          }

          .toolbar {
            display: none !important;
          }

          .page-wrap {
            padding: 0 !important;
          }

          .page {
            width: 210mm;
            min-height: auto;
            box-shadow: none !important;
            margin: 0 !important;
          }

          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>

      <div className="toolbar">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          <ArrowLeft size={18} />
          Kembali
        </button>
        <span className="text-sm text-gray-600">Laporan Raport Mental</span>
        <button
          onClick={handlePrint}
          className="ml-auto flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Printer size={18} />
          Cetak
        </button>
        <button
          onClick={handleDownloadPdf}
          disabled={isDownloadingPdf}
          className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          <Download size={18} />
          {isDownloadingPdf ? 'Membuat PDF...' : 'Download PDF'}
        </button>
      </div>

      <div className="report-root">
      <div className="page-wrap">
        <div className="page">
          <div className="report-meta">
            <div className="report-meta-row"><span>No. Stambuk</span><span>:</span><span>{studentNo || '-'}</span></div>
            <div className="report-meta-row"><span>Nama</span><span>:</span><span>{studentName || '-'}</span></div>
            <div className="report-meta-row"><span>Kelas</span><span>:</span><span>{className || '-'}</span></div>
            <div className="report-meta-row"><span>Tahun Ajaran</span><span>:</span><span>{schoolYearLabel || '-'}</span></div>
            <div className="report-meta-row"><span>Semester</span><span>:</span><span>{semesterLabel || '-'}</span></div>
          </div>

          {seksiList.map((seksi) => {
            const hasPrestasi = seksi.aspek.some((aspek) => (aspek.fieldDataType || (aspek.punyaFieldData ? 'TEXT' : 'NONE')) === 'PRESTASI');
            const hasHukuman = seksi.aspek.some((aspek) => (aspek.fieldDataType || (aspek.punyaFieldData ? 'TEXT' : 'NONE')) === 'HUKUMAN');

            return (
              <section key={seksi.id}>
                <div className="section-title">{seksi.nama}</div>

                {hasPrestasi ? (
                  <table className="mental-table">
                    <thead>
                      <tr>
                        <th style={{ width: '7%' }}>No</th>
                        <th>Nama Kegiatan</th>
                        <th style={{ width: '22%' }}>Bidang / Divisi</th>
                        <th style={{ width: '14%' }}>Juara</th>
                        <th style={{ width: '12%' }}>Nilai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seksi.aspek.map((aspek, idx) => {
                        const item = nilaiMap.get(aspek.id);
                        const prestasi = parsePrestasiData(item?.dataEkstra);
                        return (
                          <tr key={aspek.id}>
                            <td className="center">{idx + 1}</td>
                            <td>{aspek.nama}</td>
                            <td>{prestasi.bidangDivisi || '-'}</td>
                            <td className="center">{prestasi.juara || '-'}</td>
                            <td className="center">{nilaiDisplay(item)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : hasHukuman ? (
                  <table className="mental-table">
                    <thead>
                      <tr>
                        <th style={{ width: '7%' }}>No</th>
                        <th>Nama Pelanggaran</th>
                        <th style={{ width: '28%' }}>Hukuman</th>
                        <th style={{ width: '14%' }}>Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seksi.aspek.flatMap((aspek) => {
                        const rows = parseHukumanRows(nilaiMap.get(aspek.id)?.dataEkstra);
                        return rows.map((row) => ({ aspekId: aspek.id, row }));
                      }).map((item, idx) => (
                        <tr key={`${item.aspekId}-${idx}`}>
                          <td className="center">{idx + 1}</td>
                          <td>{item.row.namaPelanggaran || '-'}</td>
                          <td>{item.row.hukuman || '-'}</td>
                          <td className="center">{item.row.jumlah || '-'}</td>
                        </tr>
                      ))}
                      {seksi.aspek.flatMap((aspek) => parseHukumanRows(nilaiMap.get(aspek.id)?.dataEkstra)).length === 0 && (
                        <tr>
                          <td className="center">1</td>
                          <td>-</td>
                          <td>-</td>
                          <td className="center">-</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : seksi.tipeNilai === 'TEXT' ? (
                  <table className="mental-table">
                    <thead>
                      <tr>
                        <th style={{ width: '7%' }}>No</th>
                        <th>Aspek Penilaian</th>
                        <th>Deskripsi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seksi.aspek.map((aspek, idx) => {
                        const item = nilaiMap.get(aspek.id);
                        return (
                          <tr key={aspek.id}>
                            <td className="center">{idx + 1}</td>
                            <td>{aspek.nama}</td>
                            <td>{item?.dataEkstra || item?.nilai || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table className="mental-table">
                    <thead>
                      <tr>
                        <th style={{ width: '7%' }}>No</th>
                        <th>Aspek Penilaian</th>
                        <th style={{ width: '16%' }}>Nilai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seksi.aspek.map((aspek, idx) => {
                        const item = nilaiMap.get(aspek.id);
                        const dataText = item?.dataEkstra || '-';
                        const hasExtraText = !!item?.dataEkstra && (aspek.fieldDataType === 'TEXT' || aspek.punyaFieldData);

                        return (
                          <tr key={aspek.id}>
                            <td className="center">{idx + 1}</td>
                            <td>
                              <div>{aspek.nama}</div>
                              {hasExtraText && <div style={{ fontSize: '9pt', marginTop: '2px' }}>Data: {dataText}</div>}
                            </td>
                            <td className="center">{nilaiDisplay(item)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>
            );
          })}

          <div className="note-box">
            <strong>Catatan atau Motivasi Walisantri Untuk Ananda:</strong>
          </div>

          <div className="signature-grid">
            <div>
              <div>Mengetahui,</div>
              <div>Bagian Pengasuhan Santri</div>
              <div className="signature-name">Al Ustadz .........................................</div>
            </div>
            <div>
              <div>{school?.name || 'Pondok Pesantren Modern Darussalam Lahat'}</div>
              <div>Wakil Pimpinan</div>
              <div className="signature-name">Al Ustadz H. Abdul Somad, M. Kes</div>
            </div>
            <div>
              <div>Wali Santri,</div>
              <div>{school?.name || 'Pondok Pesantren Modern Darussalam Lahat'}</div>
              <div className="signature-name">Bpk/Ibu .........................................</div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

export default function RaportMentalLaporanPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-100 text-gray-600">Memuat laporan...</div>}>
      <MentalReportContent />
    </Suspense>
  );
}
