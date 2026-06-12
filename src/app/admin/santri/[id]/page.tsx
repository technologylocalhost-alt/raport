'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit, Trash2, FileDown } from 'lucide-react';
import { DETAIL_SECTIONS } from '../components';
import { apiFetch } from '@/lib/api-client';

interface KamarHistoryItem {
  kelas?: string;
  tahun?: string;
  smt1?: string;
  smt2?: string;
}

interface ClassHistoryItem {
  schoolYear?: string;
  semester?: string;
  levelName?: string;
  className?: string;
  waliKelasName?: string;
}

interface SantriDetail {
  id: string;
  name: string;
  studentNo?: string;
  gender?: string;
  classHistory?: ClassHistoryItem[];
  [key: string]: unknown;
}


export default function DetailSantriPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<SantriDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    apiFetch(`/api/admin/santri/${id}`)
      .then(res => res.json())
      .then(result => {
        if (!result.success) { alert('Data tidak ditemukan'); router.push('/admin/santri'); return; }
        setData(result.data);
      })
      .catch(() => { alert('Gagal memuat data'); router.push('/admin/santri'); })
      .finally(() => setIsLoading(false));
  }, [id, router]);

  const handleDelete = async () => {
    if (!confirm('Yakin ingin menghapus data santri ini?')) return;
    const res = await apiFetch(`/api/admin/santri/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) { router.push('/admin/santri'); } else { alert('Gagal menghapus'); }
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const res = await apiFetch(`/api/admin/santri/${id}/generate-pdf`, {
        method: 'POST',
      });
      const result = await res.json();
      if (!result.success) { alert(result.error || 'Gagal membuat PDF'); return; }
      const a = document.createElement('a');
      a.href = result.pdf;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      alert('Gagal membuat PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const formatDate = (val: string | null) => {
    if (!val) return '-';
    return new Date(val).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const formatValue = (key: string, val: unknown) => {
    if (val === null || val === undefined || val === '') return '-';
    if (key === 'gender') return val === 'MALE' ? 'Laki-laki (Putra)' : 'Perempuan (Putri)';
    return String(val);
  };

  const latestClass = data?.classHistory?.length
    ? data.classHistory[data.classHistory.length - 1]
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data santri...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 bg-slate-50/70">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <button onClick={() => router.push('/admin/santri')}
              className="mt-0.5 rounded-lg border border-slate-200 p-2 transition-colors hover:bg-slate-50">
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Dokumen Administrasi Santri</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">{data.name}</h1>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">No. Stambuk: {data.studentNo || '-'}</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Jenis Kelamin: {formatValue('gender', data.gender)}</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Riwayat Kelas: {latestClass ? latestClass.className : '-'}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleDownloadPdf} disabled={isGeneratingPdf}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
            <FileDown size={16} /> {isGeneratingPdf ? 'Membuat PDF...' : 'Download PDF'}
          </button>
          <button onClick={() => router.push(`/admin/santri/${id}/edit`)}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
            <Edit size={16} /> Edit
          </button>
          <button onClick={handleDelete}
            className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50">
            <Trash2 size={16} /> Hapus
          </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Nama', value: data.name },
          { label: 'No. Stambuk', value: data.studentNo || '-' },
          { label: 'Riwayat Kelas', value: latestClass ? `${latestClass.className} · ${latestClass.schoolYear}` : '-' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{item.label}</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{item.value}</div>
          </div>
        ))}
      </div>

      {/* Detail Sections - tampilkan semua */}
      {DETAIL_SECTIONS.map((section) => (
        <div key={section.title} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-slate-700">{section.title}</h2>
          </div>
          <div className="p-6">
            {section.title === 'Riwayat Kelas & Kamar di PPMDL' ? (
              <div className="space-y-6">
                {/* Riwayat Kelas dari Database */}
                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Riwayat Kelas (dari Database)</h3>
                  {data.classHistory && data.classHistory.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">No</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Tahun Ajaran</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Semester</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Tingkat</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Kelas</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Wali Kelas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.classHistory.map((ch: ClassHistoryItem, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5 text-slate-600">{idx + 1}</td>
                              <td className="px-4 py-2.5 font-medium text-slate-900">{ch.schoolYear}</td>
                              <td className="px-4 py-2.5 text-slate-700">{ch.semester}</td>
                              <td className="px-4 py-2.5 text-slate-700">{ch.levelName}</td>
                              <td className="px-4 py-2.5 font-medium text-slate-900">{ch.className}</td>
                              <td className="px-4 py-2.5 text-slate-700">{ch.waliKelasName}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm italic text-slate-400">Belum ada data riwayat kelas di database</p>
                  )}
                </div>

                {/* Field manual lainnya: riwayat kamar & kamar berkesan */}
                <div className="space-y-6 border-t border-slate-200 pt-4">
                  {section.fields.filter(f => f.key !== 'riwayatKelas').map(f => {
                    const val = data[f.key];
                    
                    // Spesial rendering untuk Riwayat Kamar yang berbentuk JSON String
                    if (f.key === 'riwayatKamar' && val) {
                      try {
                        const items = JSON.parse(String(val));
                        if (Array.isArray(items) && items.length > 0) {
                          return (
                            <div key={f.key}>
                              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{f.label}</h3>
                              <div className="overflow-x-auto rounded-lg border border-slate-200">
                                <table className="w-full text-sm">
                                  <thead className="border-b border-slate-200 bg-slate-50">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-slate-500">No</th>
                                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-slate-500">Kelas</th>
                                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-slate-500">Tahun</th>
                                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-slate-500">Smt 1</th>
                                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-slate-500">Smt 2</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {items.map((it: KamarHistoryItem, i: number) => (
                                      <tr key={i} className="hover:bg-slate-50">
                                        <td className="px-3 py-2 text-xs text-slate-500">{i + 1}</td>
                                        <td className="px-3 py-2 font-medium text-slate-900">{it.kelas || '-'}</td>
                                        <td className="px-3 py-2 text-slate-700">{it.tahun || '-'}</td>
                                        <td className="px-3 py-2 font-medium text-slate-900">{it.smt1 || '-'}</td>
                                        <td className="px-3 py-2 font-medium text-slate-900">{it.smt2 || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        }
                      } catch {
                         // Fallback ke teks biasa jika gagal diparse
                      }
                    }

                    const displayVal = formatValue(f.key, val);
                    return (
                      <div key={f.key}>
                        <dt className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{f.label}</dt>
                        <dd className={`mt-1 text-sm font-medium whitespace-pre-wrap ${
                          displayVal === '-' ? 'italic text-slate-400' : 'text-slate-900'
                        }`}>
                          {displayVal}
                        </dd>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                {section.fields.map(f => {
                  const val = data[f.key];
                  const displayVal = ('type' in f && f.type === 'date') ? formatDate(val as string | null) : formatValue(f.key, val);
                  return (
                    <div key={f.key}>
                      <dt className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{f.label}</dt>
                      <dd className={`mt-1 text-sm font-medium whitespace-pre-wrap ${
                        displayVal === '-' ? 'italic text-slate-400' : 'text-slate-900'
                      }`}>
                        {displayVal}
                      </dd>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
