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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/admin/santri')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
            <p className="text-gray-500 text-sm mt-1">No Stambuk: {data.studentNo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDownloadPdf} disabled={isGeneratingPdf}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            <FileDown size={16} /> {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
          </button>
          <button onClick={() => router.push(`/admin/santri/${id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors font-medium text-sm">
            <Edit size={16} /> Edit
          </button>
          <button onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors font-medium text-sm">
            <Trash2 size={16} /> Hapus
          </button>
        </div>
      </div>

      {/* Detail Sections - tampilkan semua */}
      {DETAIL_SECTIONS.map((section) => (
        <div key={section.title} className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-100">
            <h2 className="text-sm font-bold text-emerald-800 uppercase tracking-wider">{section.title}</h2>
          </div>
          <div className="p-6">
            {section.title === 'Riwayat Kelas & Kamar di PPMDL' ? (
              <div className="space-y-6">
                {/* Riwayat Kelas dari Database */}
                <div>
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Riwayat Kelas (dari Database)</h3>
                  {data.classHistory && data.classHistory.length > 0 ? (
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">No</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Tahun Ajaran</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Semester</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Tingkat</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Kelas</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Wali Kelas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {data.classHistory.map((ch: ClassHistoryItem, idx: number) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-2.5 text-gray-700">{idx + 1}</td>
                              <td className="px-4 py-2.5 text-gray-900 font-medium">{ch.schoolYear}</td>
                              <td className="px-4 py-2.5 text-gray-700">{ch.semester}</td>
                              <td className="px-4 py-2.5 text-gray-700">{ch.levelName}</td>
                              <td className="px-4 py-2.5 text-gray-900 font-medium">{ch.className}</td>
                              <td className="px-4 py-2.5 text-gray-700">{ch.waliKelasName}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Belum ada data riwayat kelas di database</p>
                  )}
                </div>

                {/* Field manual lainnya: riwayat kamar & kamar berkesan */}
                <div className="space-y-6 pt-4 border-t border-gray-100">
                  {section.fields.filter(f => f.key !== 'riwayatKelas').map(f => {
                    const val = data[f.key];
                    
                    // Spesial rendering untuk Riwayat Kamar yang berbentuk JSON String
                    if (f.key === 'riwayatKamar' && val) {
                      try {
                        const items = JSON.parse(String(val));
                        if (Array.isArray(items) && items.length > 0) {
                          return (
                            <div key={f.key}>
                              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">{f.label}</h3>
                              <div className="overflow-x-auto border rounded-lg">
                                <table className="w-full text-sm">
                                  <thead className="bg-emerald-50/50 border-b border-emerald-100">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs font-bold text-emerald-800 uppercase">No</th>
                                      <th className="px-3 py-2 text-left text-xs font-bold text-emerald-800 uppercase">Kelas</th>
                                      <th className="px-3 py-2 text-left text-xs font-bold text-emerald-800 uppercase">Tahun</th>
                                      <th className="px-3 py-2 text-left text-xs font-bold text-emerald-800 uppercase">Smt 1</th>
                                      <th className="px-3 py-2 text-left text-xs font-bold text-emerald-800 uppercase">Smt 2</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {items.map((it: KamarHistoryItem, i: number) => (
                                      <tr key={i} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 text-gray-500 text-xs">{i + 1}</td>
                                        <td className="px-3 py-2 text-gray-900 font-medium">{it.kelas || '-'}</td>
                                        <td className="px-3 py-2 text-gray-700">{it.tahun || '-'}</td>
                                        <td className="px-3 py-2 text-gray-900 font-medium">{it.smt1 || '-'}</td>
                                        <td className="px-3 py-2 text-gray-900 font-medium">{it.smt2 || '-'}</td>
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
                        <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{f.label}</dt>
                        <dd className={`mt-1 text-sm font-medium whitespace-pre-wrap ${
                          displayVal === '-' ? 'text-gray-400 italic' : 'text-gray-900'
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
                      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{f.label}</dt>
                      <dd className={`mt-1 text-sm font-medium whitespace-pre-wrap ${
                        displayVal === '-' ? 'text-gray-400 italic' : 'text-gray-900'
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
